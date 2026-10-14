import { NextResponse } from "next/server";
import {
  batch,
  dbErrorMessage,
  execute,
  isUniqueViolation,
  placeholders,
  query,
  statement,
} from "@/lib/db";
import type { CheckoutItem, FulfillmentMethod } from "@/lib/orders";
import { verifyCaptcha } from "@/lib/turnstile";
import { getClientIp, rateLimitKeyFromIp } from "@/lib/client-ip";
import { isValidPhone, normalizePhone } from "@/lib/phone";
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

interface ProductRow {
  id: number;
  name: string;
  price: number;
  weight_grams: number;
}

interface VariantRow {
  product_id: number;
  name: string;
  price_delta: number;
  weight_grams: number;
}

/**
 * Error item keranjang dengan kode terstruktur, agar klien bisa menampilkan
 * pesan sesuai bahasa aktif dan menawarkan "hapus dari keranjang".
 */
function itemError(
  code: "PRODUCT_NOT_FOUND" | "VARIANT_INVALID" | "VARIANT_REQUIRED",
  error: string,
  productId: number,
  variant: string | null
) {
  return NextResponse.json({ error, code, productId, variant }, { status: 409 });
}

// Cek status pesanan dipindah ke POST /api/orders/lookup (Skill 21): nomor HP
// tidak lagi masuk URL/log. GET pada route ini sengaja tidak ada (405).

export async function POST(req: Request) {
  // Hanya JSON: form lintas situs (enctype text/plain) tidak memicu preflight
  // CORS, sehingga tanpa cek ini halaman lain bisa membuat pesanan palsu atas
  // nama pengunjungnya (CSRF). fetch() dengan JSON dari situs ini selalu lolos.
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Content-Type harus application/json" }, { status: 415 });
  }
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
  const captchaToken = String(body.captchaToken ?? "").trim();
  const ip = getClientIp(req);
  const ipKey = rateLimitKeyFromIp(ip);
  // Dua kunci terpisah: kuota pesanan sukses, dan kegagalan captcha (batas lebih
  // longgar) — agar token sampah tidak bisa mengunci checkout pelanggan asli.
  const orderKey = `order:${ipKey}`;
  const captchaKey = `ordercaptcha:${ipKey}`;

  // 1) Rate limit — tolak cepat sebelum kerja lain.
  const orderRl = checkRateLimit(orderKey, ORDER_LIMIT, ORDER_WINDOW_MS);
  if (orderRl.limited) return tooManyOrders(orderRl.retryAfterSec);
  // Jatah "captcha gagal" diambil atomik sebelum `await` (anti burst paralel),
  // lalu dikembalikan bila captcha lolos.
  const captchaRl = consumeRateLimit(captchaKey, CAPTCHA_FAIL_LIMIT, ORDER_WINDOW_MS);
  if (captchaRl.limited) return tooManyOrders(captchaRl.retryAfterSec);

  // 2) Verifikasi Turnstile SEBELUM kerja lain. Error dikirim sebagai kode agar
  // klien menampilkannya sesuai bahasa aktif.
  const captcha = await verifyCaptcha(captchaToken, ip, "checkout");
  if (!captcha.ok) {
    // 503 = salah konfigurasi server (bukan ulah klien) → jatah dikembalikan.
    if (captcha.status === 503) refundRateLimit(captchaKey, captchaRl.stamp);
    return NextResponse.json({ error: captcha.code, code: captcha.code }, { status: captcha.status });
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
  // Simpan dalam format ternormalisasi agar Cek Pesanan cocok apa pun format ketiknya.
  const phoneNorm = normalizePhone(phone);
  if (!isValidPhone(phoneNorm)) {
    return NextResponse.json({ error: "Nomor HP tidak valid" }, { status: 400 });
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

  try {
    // Ambil nama & harga produk dari DB (jangan percaya harga dari client).
    // Maks 50 id unik (batas baris di atas) — di bawah batas 100 parameter D1.
    const ids = [...new Set(items.map((it) => it.productId))];
    const idPlaceholders = placeholders(ids.length);
    const productRows = await query<ProductRow>(
      `SELECT id, name, price, weight_grams FROM products WHERE id IN (${idPlaceholders})`,
      ids
    );
    const byId = new Map(productRows.map((p) => [p.id, p]));

    // Varian per produk: selisih harga & berat (override). Dicocokkan per nama.
    const variantRows = await query<VariantRow>(
      `SELECT product_id, name, price_delta, weight_grams FROM product_variants
        WHERE product_id IN (${idPlaceholders})`,
      ids
    );
    const variantsByProduct = new Map<number, Map<string, VariantRow>>();
    for (const v of variantRows) {
      if (!variantsByProduct.has(v.product_id)) {
        variantsByProduct.set(v.product_id, new Map());
      }
      variantsByProduct.get(v.product_id)!.set(v.name, v);
    }

    const orderItems: CheckoutItem[] = [];
    for (const it of items) {
      const p = byId.get(it.productId);
      if (!p) {
        return itemError(
          "PRODUCT_NOT_FOUND",
          `Produk (id ${it.productId}) tidak ditemukan`,
          it.productId,
          it.variant
        );
      }
      // Validasi varian dari client terhadap DB:
      // - produk tanpa varian: tolak nama varian apa pun;
      // - produk bervarian: varian WAJIB dipilih dan harus terdaftar — bila tidak,
      //   klien bisa membayar harga dasar untuk varian yang lebih mahal.
      const known = variantsByProduct.get(p.id);
      if (known && !it.variant) {
        return itemError(
          "VARIANT_REQUIRED",
          `Pilih varian untuk produk "${p.name}"`,
          p.id,
          null
        );
      }
      const v = it.variant ? known?.get(it.variant) : undefined;
      if (it.variant && !v) {
        return itemError(
          "VARIANT_INVALID",
          `Varian "${it.variant}" untuk produk "${p.name}" sudah tidak tersedia`,
          p.id,
          it.variant
        );
      }
      // Harga & berat dari DB: harga = produk + selisih varian; berat varian
      // bila > 0, selain itu berat produk (rumus sama dengan lib/pricing.ts).
      const unitPrice = p.price + (v ? Number(v.price_delta) : 0);
      if (unitPrice < 0) {
        throw new Error(`Harga varian negatif untuk produk ${p.id}`);
      }
      const vWeight = v ? Number(v.weight_grams) : 0;
      orderItems.push({
        productId: p.id,
        name: p.name,
        variant: v ? v.name : null,
        quantity: it.quantity,
        unit_price: unitPrice,
        weight_grams: vWeight > 0 ? vWeight : p.weight_grams,
      });
    }
    const totalEstimate = orderItems.reduce(
      (sum, it) => sum + it.unit_price * it.quantity,
      0
    );
    // Batas wajar total (setara INT UNSIGNED skema lama, juga menjaga data saat
    // ekspor balik): tolak sebelum INSERT agar tidak berujung error DB (yang
    // mengembalikan jatah kuota).
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

    // Generate Order ID unik: nomor urut berikutnya hari ini (WIB), lalu retry
    // bila UNIQUE order_code bentrok dengan request bersamaan.
    const prefix = `ORD-${dateWibYYYYMMDD()}-`;
    // Nomor urut dibandingkan sebagai angka (bukan string) agar tetap benar
    // bila suatu hari melewati 9999.
    const maxRows = await query<{ seq: number | null }>(
      "SELECT MAX(CAST(substr(order_code, ?) AS INTEGER)) AS seq FROM orders WHERE order_code LIKE ?",
      [prefix.length + 1, `${prefix}%`]
    );
    let seq = Number(maxRows[0]?.seq ?? 0) + 1;

    // Semua item sebagai satu parameter JSON yang dibuat server (bukan input
    // mentah klien): disisipkan dengan SATU statement lewat json_each, sehingga
    // checkout selalu 2 statement berapa pun jumlah baris — paket Free D1
    // membatasi 50 query per invocation Worker.
    const itemsJson = JSON.stringify(
      orderItems.map((it) => ({
        p: it.productId,
        n: it.name,
        v: it.variant,
        q: it.quantity,
        u: it.unit_price,
      }))
    );

    let orderCode = "";
    let saved = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      orderCode = `${prefix}${String(seq).padStart(4, "0")}`;
      try {
        // Order + semua item dalam satu batch D1 (atomik): gagal di mana pun →
        // tidak ada pesanan setengah jadi. Item merujuk pesanan lewat order_code
        // karena id baru belum diketahui sebelum batch berjalan.
        const [, itemsRes] = await batch([
          statement(
            `INSERT INTO orders
               (order_code, recipient_name, phone, fulfillment_method,
                address, city, location_note, status, total_estimate, note)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Menunggu Konfirmasi', ?, ?)`,
            [
              orderCode,
              recipientName,
              phoneNorm,
              method,
              address,
              city,
              locationNote,
              totalEstimate,
              note,
            ]
          ),
          // Snapshot nama & harga saat pesan, urut sesuai keranjang.
          statement(
            `INSERT INTO order_items
               (order_id, product_id, product_name, variant, quantity, unit_price)
             SELECT o.id,
                    json_extract(j.value, '$.p'),
                    json_extract(j.value, '$.n'),
                    json_extract(j.value, '$.v'),
                    json_extract(j.value, '$.q'),
                    json_extract(j.value, '$.u')
               FROM orders o, json_each(?) j
              WHERE o.order_code = ?
              ORDER BY j.key`,
            [itemsJson, orderCode]
          ),
        ]);
        // Pengaman: semua item harus tersimpan (bila tidak, pesanan dibatalkan).
        if (itemsRes.meta.changes !== orderItems.length) {
          await execute("DELETE FROM orders WHERE order_code = ?", [orderCode]);
          throw new Error(
            `Item pesanan tersimpan ${itemsRes.meta.changes}/${orderItems.length}`
          );
        }
        saved = true;
        break;
      } catch (err: unknown) {
        if (isUniqueViolation(err)) {
          seq++;
          continue;
        }
        throw err;
      }
    }
    if (!saved) {
      throw new Error("Gagal membuat Order ID unik setelah beberapa percobaan");
    }

    return NextResponse.json({
      order_code: orderCode,
      items: orderItems,
      total_estimate: totalEstimate,
      total_weight: totalWeight,
    });
  } catch (err) {
    refundRateLimit(orderKey, quota.stamp);
    // Log ringkas (pesan singkat), bukan objek error utuh yang bisa memuat PII.
    console.error("POST /api/orders gagal:", dbErrorMessage(err));
    return NextResponse.json(
      { error: "Gagal menyimpan pesanan. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
