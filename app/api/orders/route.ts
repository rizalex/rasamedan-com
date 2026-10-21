import { NextResponse } from "next/server";
import {
  batch,
  dbErrorMessage,
  execute,
  isUniqueViolation,
  query,
  statement,
} from "@/lib/db";
import type { FulfillmentMethod } from "@/lib/orders";
import {
  parseIncomingItems,
  resolveCheckoutItems,
  totalWeightGrams,
} from "@/lib/checkout-items";
import { resolveOrderShipping } from "@/lib/shipping";
import { verifyCaptcha } from "@/lib/turnstile";
import { getClientIp, rateLimitKeyFromIp } from "@/lib/client-ip";
import { isValidPhone, normalizePhone } from "@/lib/phone.mjs";
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
  let city = body.city ? String(body.city).trim() : null;
  const locationNote = body.location_note ? String(body.location_note).trim() : null;
  const note = body.note ? String(body.note).trim() : null;
  // Estimasi ongkir pilihan pelanggan (Skill 31): hanya kode; harga dicocokkan
  // server dengan cache tarifnya sendiri.
  const shippingInput =
    method === "kurir" && body.shipping && typeof body.shipping === "object"
      ? (body.shipping as { districtCode?: unknown; courierCode?: unknown; serviceCode?: unknown })
      : null;
  const hasDistrict = typeof shippingInput?.districtCode === "string" && shippingInput.districtCode !== "";
  const captchaToken = String(body.captchaToken ?? "").trim();
  const ip = getClientIp(req);
  const ipKey = rateLimitKeyFromIp(ip);
  // Dua kunci terpisah: kuota pesanan sukses, dan kegagalan captcha (batas lebih
  // longgar) — agar token sampah tidak bisa mengunci checkout pelanggan asli.
  const orderKey = `order:${ipKey}`;
  const captchaKey = `ordercaptcha:${ipKey}`;

  // 1) Rate limit — tolak cepat sebelum kerja lain.
  const orderRl = await checkRateLimit(orderKey, ORDER_LIMIT, ORDER_WINDOW_MS);
  if (orderRl.limited) return tooManyOrders(orderRl.retryAfterSec);
  // Jatah "captcha gagal" diambil atomik di D1 sebelum captcha (anti burst paralel),
  // lalu dikembalikan bila captcha lolos.
  const captchaRl = await consumeRateLimit(captchaKey, CAPTCHA_FAIL_LIMIT, ORDER_WINDOW_MS);
  if (captchaRl.limited) return tooManyOrders(captchaRl.retryAfterSec);

  // 2) Verifikasi Turnstile SEBELUM kerja lain. Error dikirim sebagai kode agar
  // klien menampilkannya sesuai bahasa aktif.
  const captcha = await verifyCaptcha(captchaToken, ip, "checkout");
  if (!captcha.ok) {
    // 503 = salah konfigurasi server (bukan ulah klien) → jatah dikembalikan.
    if (captcha.status === 503) await refundRateLimit(captchaKey, captchaRl.stamp);
    return NextResponse.json({ error: captcha.code, code: captcha.code }, { status: captcha.status });
  }
  await refundRateLimit(captchaKey, captchaRl.stamp);

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
  // Kecamatan dari pilihan wilayah (Skill 31) menggantikan teks kecamatan/kota.
  if (method === "kurir" && (!address || (!city && !hasDistrict))) {
    return NextResponse.json(
      { error: "Alamat dan kecamatan/kota wajib diisi untuk pengiriman kurir" },
      { status: 400 }
    );
  }
  const parsedItems = parseIncomingItems(body.items);
  if (!parsedItems.ok) {
    return NextResponse.json({ error: parsedItems.error }, { status: 400 });
  }

  // 3) Ambil satu jatah kuota secara atomik (cek + catat dalam satu INSERT
  // bersyarat di D1, agar burst paralel tidak lolos). Salah isi form sudah ditolak di
  // atas tanpa memotong kuota; di sini jatah hanya dikembalikan untuk error
  // server (catch), bukan untuk produk/varian tidak valid — agar request itu
  // tidak bisa membebani DB tanpa batas.
  const quota = await consumeRateLimit(orderKey, ORDER_LIMIT, ORDER_WINDOW_MS);
  if (quota.limited) return tooManyOrders(quota.retryAfterSec);

  try {
    // Nama, harga & berat dari DB (jangan percaya harga dari client).
    const resolved = await resolveCheckoutItems(parsedItems.items);
    if (!resolved.ok) {
      const { code, error, productId, variant } = resolved;
      return NextResponse.json({ error, code, productId, variant }, { status: 409 });
    }
    const orderItems = resolved.items;
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

    // Estimasi ongkir (Skill 31): dicocokkan dengan cache tarif server.
    const shipping = await resolveOrderShipping(
      hasDistrict ? shippingInput : null,
      totalWeightGrams(orderItems)
    );
    // Salah pilih ongkir = koreksi form, bukan pesanan → jatah kuota dikembalikan.
    if (shipping.kind === "invalid-district" && !city) {
      await refundRateLimit(orderKey, quota.stamp);
      return NextResponse.json(
        { error: "Kecamatan tujuan tidak valid. Pilih ulang kecamatan.", code: "SHIPPING_DISTRICT_INVALID" },
        { status: 400 }
      );
    }
    if (shipping.kind === "required") {
      await refundRateLimit(orderKey, quota.stamp);
      return NextResponse.json(
        { error: "Pilih kurir pengiriman terlebih dahulu.", code: "SHIPPING_REQUIRED" },
        { status: 400 }
      );
    }
    const ship = shipping.kind === "ok" ? shipping : null;
    if (ship) city = ship.districtLabel;

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
                address, city, location_note, status, total_estimate, note,
                shipping_district_code, shipping_courier, shipping_service,
                shipping_etd, shipping_estimate, shipping_weight_grams, shipping_quoted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Menunggu Konfirmasi', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
              ship?.districtCode ?? null,
              ship?.courierCode ?? null,
              ship?.snapshot ? `${ship.snapshot.courierName} · ${ship.snapshot.serviceName}` : null,
              ship?.snapshot?.etd ?? null,
              ship?.snapshot?.price ?? null,
              ship?.snapshot?.weightGrams ?? null,
              ship?.quotedAt ?? null,
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
      city,
      shipping: ship?.snapshot ?? null,
      shippingDropped: ship?.dropped ?? false,
    });
  } catch (err) {
    await refundRateLimit(orderKey, quota.stamp);
    // Log ringkas (pesan singkat), bukan objek error utuh yang bisa memuat PII.
    console.error("POST /api/orders gagal:", dbErrorMessage(err));
    return NextResponse.json(
      { error: "Gagal menyimpan pesanan. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
