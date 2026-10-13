import { NextResponse } from "next/server";
import type { PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool } from "@/lib/db";
import type { CheckoutItem, FulfillmentMethod } from "@/lib/orders";
import { verifyRecaptcha } from "@/lib/recaptcha";
import {
  checkRateLimit,
  consumeRateLimit,
  refundRateLimit,
} from "@/lib/rate-limit";

// Batas pembuatan pesanan per IP (Skill 21.2 no. 3).
const ORDER_LIMIT = 10; // pesanan sukses per jam
const CAPTCHA_FAIL_LIMIT = 30; // captcha gagal per jam
const ORDER_WINDOW_MS = 60 * 60 * 1000; // 1 jam

function tooManyOrders(retryAfterSec: number) {
  const mins = Math.ceil(retryAfterSec / 60);
  return NextResponse.json(
    { error: `Terlalu banyak pesanan dari jaringan ini. Coba lagi dalam ${mins} menit.` },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

export const dynamic = "force-dynamic";

type IncomingItem = { productId: number; variant: string | null; quantity: number };

/** Alamat IP client (di belakang proxy/Passenger memakai header X-Forwarded-For). */
function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/** Tanggal WIB (Asia/Jakarta) dalam format YYYYMMDD untuk Order ID. */
function dateWibYYYYMMDD(): string {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return s.replace(/-/g, "");
}

interface ProductRow extends RowDataPacket {
  id: number;
  name: string;
  price: number;
  weight_grams: number;
}

interface VariantWeightRow extends RowDataPacket {
  product_id: number;
  name: string;
  weight_grams: number;
}

interface OrderRow extends RowDataPacket {
  id: number;
  order_code: string;
  recipient_name: string;
  fulfillment_method: string;
  status: string;
  total_estimate: number | null;
  created_at: Date;
}

interface OrderItemRow extends RowDataPacket {
  order_id: number;
  product_name: string;
  variant: string | null;
  quantity: number;
  unit_price: number;
}

/**
 * GET /api/orders?phone=...&code=...
 * Cek status pesanan tanpa akun. `phone` WAJIB dan SELALU jadi filter — pelanggan
 * hanya bisa melihat pesanan milik nomor HP-nya sendiri (SKILLS.md Skill 8).
 * Semua parameter memakai parameterized query (aman dari SQL injection).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const phone = (url.searchParams.get("phone") ?? "").trim();
  const code = (url.searchParams.get("code") ?? "").trim();
  const recaptchaToken = (url.searchParams.get("captcha") ?? "").trim();
  const ip = getClientIp(req);
  const rlKey = `checkorder:${ip}`;

  if (!phone) {
    return NextResponse.json(
      { error: "Nomor HP wajib diisi" },
      { status: 400 }
    );
  }

  // 1) Rate limit — cegah brute force enumerasi nomor HP / Order ID. Jatah
  // diambil atomik di awal (sebelum `await` captcha) agar burst paralel tidak
  // lolos; dikembalikan bila pesanan ditemukan atau terjadi error server.
  const rl = consumeRateLimit(rlKey);
  if (rl.limited) {
    const mins = Math.ceil(rl.retryAfterSec / 60);
    return NextResponse.json(
      { error: `Terlalu banyak percobaan. Coba lagi dalam ${mins} menit.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  // 2) Verifikasi reCAPTCHA SEBELUM query DB (dilewati bila key tidak dikonfigurasi).
  const captcha = await verifyRecaptcha(recaptchaToken, ip);
  if (!captcha.ok) {
    return NextResponse.json({ error: captcha.error }, { status: 400 });
  }

  let refunded = false;
  try {
    // phone selalu difilter; code opsional sebagai filter tambahan (bukan pengganti).
    const params: (string | number)[] = [phone];
    let sql =
      "SELECT id, order_code, recipient_name, fulfillment_method, status, total_estimate, created_at FROM orders WHERE phone = ?";
    if (code) {
      sql += " AND order_code = ?";
      params.push(code);
    }
    sql += " ORDER BY created_at DESC LIMIT 50";

    const [orders] = await pool.query<OrderRow[]>(sql, params);
    if (orders.length === 0) {
      // Jatah tetap terpakai (kemungkinan menebak nomor/kode).
      return NextResponse.json({ orders: [] });
    }
    // Pencarian valid → kembalikan jatah pencarian ini saja (bukan reset), agar
    // tebakan gagal sebelumnya tetap terhitung — mencegah bypass dengan menyelipkan
    // pencarian nomor sendiri di antara tebakan nomor orang lain.
    refundRateLimit(rlKey, rl.stamp);
    refunded = true;

    const ids = orders.map((o) => o.id);
    const [items] = await pool.query<OrderItemRow[]>(
      "SELECT order_id, product_name, variant, quantity, unit_price FROM order_items WHERE order_id IN (?)",
      [ids]
    );

    const result = orders.map((o) => ({
      order_code: o.order_code,
      recipient_name: o.recipient_name,
      fulfillment_method: o.fulfillment_method,
      status: o.status,
      total_estimate: o.total_estimate,
      created_at: o.created_at,
      items: items
        .filter((it) => it.order_id === o.id)
        .map((it) => ({
          product_name: it.product_name,
          variant: it.variant,
          quantity: it.quantity,
          unit_price: it.unit_price,
        })),
    }));

    return NextResponse.json({ orders: result });
  } catch (err) {
    if (!refunded) refundRateLimit(rlKey, rl.stamp);
    console.error("GET /api/orders gagal:", err);
    return NextResponse.json(
      { error: "Gagal mengambil data pesanan" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const method = body.fulfillment_method as FulfillmentMethod;
  const recipientName = String(body.recipient_name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const address = body.address ? String(body.address).trim() : null;
  const city = body.city ? String(body.city).trim() : null;
  const locationNote = body.location_note ? String(body.location_note).trim() : null;
  const note = body.note ? String(body.note).trim() : null;
  const rawItems = Array.isArray(body.items) ? (body.items as IncomingItem[]) : [];
  const captchaToken = String(body.captcha ?? "").trim();
  const ip = getClientIp(req);
  // Dua kunci terpisah: kuota pesanan sukses, dan kegagalan captcha (batas lebih
  // longgar) — agar token sampah tidak bisa mengunci checkout pelanggan asli.
  const orderKey = `order:${ip}`;
  const captchaKey = `ordercaptcha:${ip}`;

  // 1) Rate limit — tolak cepat sebelum kerja lain.
  const orderRl = checkRateLimit(orderKey, ORDER_LIMIT, ORDER_WINDOW_MS);
  if (orderRl.limited) return tooManyOrders(orderRl.retryAfterSec);
  // Jatah "captcha gagal" diambil atomik sebelum `await` (anti burst paralel),
  // lalu dikembalikan bila captcha lolos.
  const captchaRl = consumeRateLimit(captchaKey, CAPTCHA_FAIL_LIMIT, ORDER_WINDOW_MS);
  if (captchaRl.limited) return tooManyOrders(captchaRl.retryAfterSec);

  // 2) Verifikasi captcha SEBELUM kerja lain (dilewati bila key tidak dikonfigurasi).
  const captcha = await verifyRecaptcha(captchaToken, ip);
  if (!captcha.ok) {
    return NextResponse.json({ error: captcha.error }, { status: 400 });
  }
  refundRateLimit(captchaKey, captchaRl.stamp);

  // --- Validasi ---
  // Batas panjang input (anti penyalahgunaan; selaras batas kolom DB).
  if (
    recipientName.length > 100 ||
    phone.length > 30 ||
    (address?.length ?? 0) > 500 ||
    (city?.length ?? 0) > 120 ||
    (locationNote?.length ?? 0) > 500 ||
    (note?.length ?? 0) > 500
  ) {
    return NextResponse.json(
      { error: "Ada isian yang melebihi batas panjang" },
      { status: 400 }
    );
  }
  if (method !== "kurir" && method !== "pickup") {
    return NextResponse.json({ error: "Metode pengambilan tidak valid" }, { status: 400 });
  }
  if (!recipientName) {
    return NextResponse.json({ error: "Nama penerima wajib diisi" }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: "Nomor HP wajib diisi" }, { status: 400 });
  }
  if (method === "kurir" && (!address || !city)) {
    return NextResponse.json(
      { error: "Alamat dan kecamatan/kota wajib diisi untuk pengiriman kurir" },
      { status: 400 }
    );
  }
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "Keranjang kosong" }, { status: 400 });
  }
  // Batas jumlah baris dicek pada array mentah, sebelum diproses.
  if (rawItems.length > 50) {
    return NextResponse.json(
      { error: "Maksimal 50 baris item per pesanan" },
      { status: 400 }
    );
  }
  const items = rawItems.map((it) => ({
    productId: Number(it?.productId),
    variant: it?.variant ? String(it.variant).slice(0, 100) : null,
    quantity: Number(it?.quantity),
  }));
  // Baris tidak valid DITOLAK, bukan dibuang diam-diam (agar item pelanggan
  // tidak hilang dari pesanan tanpa pemberitahuan).
  if (items.some((it) => !Number.isInteger(it.productId))) {
    return NextResponse.json({ error: "Ada item yang tidak valid" }, { status: 400 });
  }
  if (items.some((it) => !Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 99)) {
    return NextResponse.json(
      { error: "Jumlah per item harus 1–99" },
      { status: 400 }
    );
  }

  // 3) Ambil satu jatah kuota secara atomik (cek + catat tanpa `await` di
  // antaranya, agar burst paralel tidak lolos). Salah isi form sudah ditolak di
  // atas tanpa memotong kuota; di sini jatah hanya dikembalikan untuk error
  // server (catch), bukan untuk produk/varian tidak valid — agar request itu
  // tidak bisa membebani DB tanpa batas.
  const quota = consumeRateLimit(orderKey, ORDER_LIMIT, ORDER_WINDOW_MS);
  if (quota.limited) return tooManyOrders(quota.retryAfterSec);

  let conn: PoolConnection | null = null;
  try {
    conn = await pool.getConnection();

    // Ambil nama & harga produk dari DB (jangan percaya harga dari client).
    const ids = [...new Set(items.map((it) => it.productId))];
    const [productRows] = await conn.query<ProductRow[]>(
      "SELECT id, name, price, weight_grams FROM products WHERE id IN (?)",
      [ids]
    );
    const byId = new Map(productRows.map((p) => [p.id, p]));

    // Berat per varian (override) + daftar varian valid. Kunci: `${productId}::${variantName}`.
    const [variantRows] = await conn.query<VariantWeightRow[]>(
      "SELECT product_id, name, weight_grams FROM product_variants WHERE product_id IN (?)",
      [ids]
    );
    const variantWeight = new Map<string, number>();
    const validVariants = new Map<number, Set<string>>();
    for (const v of variantRows) {
      variantWeight.set(`${v.product_id}::${v.name}`, v.weight_grams);
      if (!validVariants.has(v.product_id)) {
        validVariants.set(v.product_id, new Set());
      }
      validVariants.get(v.product_id)!.add(v.name);
    }

    const orderItems: CheckoutItem[] = [];
    for (const it of items) {
      const p = byId.get(it.productId);
      if (!p) {
        return NextResponse.json(
          { error: `Produk (id ${it.productId}) tidak ditemukan` },
          { status: 400 }
        );
      }
      // Validasi nama varian dari client terhadap DB: produk tanpa varian → paksa
      // null; produk bervarian → varian harus terdaftar (tolak string bebas).
      const known = validVariants.get(p.id);
      if (it.variant && (!known || !known.has(it.variant))) {
        return NextResponse.json(
          { error: `Varian tidak valid untuk produk "${p.name}"` },
          { status: 400 }
        );
      }
      const variant = known ? it.variant : null;
      // Gunakan berat varian jika ada (> 0), fallback ke berat produk utama.
      const vWeight = variant
        ? variantWeight.get(`${p.id}::${variant}`) ?? 0
        : 0;
      orderItems.push({
        productId: p.id,
        name: p.name,
        variant,
        quantity: it.quantity,
        unit_price: p.price,
        weight_grams: vWeight > 0 ? vWeight : p.weight_grams,
      });
    }
    const totalEstimate = orderItems.reduce(
      (sum, it) => sum + it.unit_price * it.quantity,
      0
    );
    // Kolom total_estimate INT UNSIGNED: tolak sebelum INSERT agar tidak
    // berujung error DB (yang mengembalikan jatah kuota) atau nilai terpotong.
    if (totalEstimate > 4_294_967_295) {
      return NextResponse.json(
        { error: "Total pesanan terlalu besar" },
        { status: 400 }
      );
    }
    const totalWeight = orderItems.reduce(
      (sum, it) => sum + it.weight_grams * it.quantity,
      0
    );

    await conn.beginTransaction();

    // Generate Order ID unik: retry pada UNIQUE constraint (aman dari race).
    const prefix = `ORD-${dateWibYYYYMMDD()}-`;
    const [maxRows] = await conn.query<RowDataPacket[]>(
      "SELECT order_code FROM orders WHERE order_code LIKE ? ORDER BY order_code DESC LIMIT 1",
      [`${prefix}%`]
    );
    let seq =
      maxRows.length > 0
        ? parseInt(String(maxRows[0].order_code).slice(-4), 10) + 1
        : 1;

    let orderId = 0;
    let orderCode = "";
    for (let attempt = 0; attempt < 20; attempt++) {
      orderCode = `${prefix}${String(seq).padStart(4, "0")}`;
      try {
        const [res] = await conn.execute<ResultSetHeader>(
          `INSERT INTO orders
             (order_code, recipient_name, phone, fulfillment_method,
              address, city, location_note, status, total_estimate, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Menunggu Konfirmasi', ?, ?)`,
          [
            orderCode,
            recipientName,
            phone,
            method,
            address,
            city,
            locationNote,
            totalEstimate,
            note,
          ]
        );
        orderId = res.insertId;
        break;
      } catch (err: unknown) {
        if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
          seq++;
          continue;
        }
        throw err;
      }
    }
    if (!orderId) {
      throw new Error("Gagal membuat Order ID unik setelah beberapa percobaan");
    }

    // Insert order_items (snapshot nama & harga).
    for (const it of orderItems) {
      await conn.execute(
        `INSERT INTO order_items
           (order_id, product_id, product_name, variant, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, it.productId, it.name, it.variant, it.quantity, it.unit_price]
      );
    }

    await conn.commit();

    return NextResponse.json({
      order_code: orderCode,
      items: orderItems,
      total_estimate: totalEstimate,
      total_weight: totalWeight,
    });
  } catch (err) {
    refundRateLimit(orderKey, quota.stamp);
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        /* abaikan */
      }
    }
    console.error("POST /api/orders gagal:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan pesanan. Silakan coba lagi." },
      { status: 500 }
    );
  } finally {
    if (conn) conn.release();
  }
}
