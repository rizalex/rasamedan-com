import { NextResponse } from "next/server";
import { dbErrorMessage, placeholders, query } from "@/lib/db";
import { verifyCaptcha } from "@/lib/turnstile";
import { getClientIp, rateLimitKeyFromIp } from "@/lib/client-ip";
import { isValidPhone, normalizePhone } from "@/lib/phone.mjs";
import { consumeRateLimit, refundRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface OrderRow {
  id: number;
  order_code: string;
  recipient_name: string;
  fulfillment_method: string;
  status: string;
  total_estimate: number | null;
  /** ISO-8601 UTC. */
  created_at: string;
}

interface OrderItemRow {
  order_id: number;
  product_name: string;
  variant: string | null;
  quantity: number;
  unit_price: number;
}

/**
 * POST /api/orders/lookup — Cek status pesanan tanpa akun (Skill 8).
 * Body JSON: { phone, code?, captchaToken }.
 *
 * POST (bukan GET) agar nomor HP & token captcha tidak masuk URL, riwayat browser,
 * header Referer, maupun log akses (Skill 21). `phone` WAJIB dan SELALU jadi
 * filter — pelanggan hanya bisa melihat pesanan milik nomor HP-nya sendiri.
 * Urutan cek: format → rate limit → captcha → DB.
 */
export async function POST(req: Request) {
  // Hanya JSON (anti-CSRF form lintas situs enctype text/plain).
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

  const phone = String(body.phone ?? "").trim();
  const code = String(body.code ?? "").trim();
  const captchaToken = String(body.captchaToken ?? "").trim();
  const ip = getClientIp(req);
  const rlKey = `checkorder:${rateLimitKeyFromIp(ip)}`;

  if (!phone) {
    return NextResponse.json({ error: "Nomor HP wajib diisi" }, { status: 400 });
  }
  // Format nomor dinormalisasi agar "0812-…", "+62 812…" dan "0812…" cocok.
  // Format yang jelas salah ditolak SEBELUM rate limit (bukan tebakan nomor).
  const phoneNorm = normalizePhone(phone);
  if (phone.length > 30 || !isValidPhone(phoneNorm) || code.length > 30) {
    return NextResponse.json({ error: "Nomor HP tidak valid" }, { status: 400 });
  }

  // 1) Rate limit — cegah brute force enumerasi nomor HP / Order ID. Jatah
  // diambil atomik di D1 di awal (sebelum captcha) agar burst paralel tidak
  // lolos; dikembalikan bila pesanan ditemukan atau terjadi error server.
  const rl = await consumeRateLimit(rlKey);
  if (rl.limited) {
    const mins = Math.ceil(rl.retryAfterSec / 60);
    return NextResponse.json(
      { error: `Terlalu banyak percobaan. Coba lagi dalam ${mins} menit.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  // 2) Verifikasi Turnstile SEBELUM query DB.
  const captcha = await verifyCaptcha(captchaToken, ip, "check-order");
  if (!captcha.ok) {
    // 503 = salah konfigurasi server (bukan ulah klien) → jatah dikembalikan.
    if (captcha.status === 503) await refundRateLimit(rlKey, rl.stamp);
    return NextResponse.json({ error: captcha.code, code: captcha.code }, { status: captcha.status });
  }

  let refunded = false;
  try {
    // phone selalu difilter; code opsional sebagai filter tambahan (bukan pengganti).
    // Cocokkan format ternormalisasi (pesanan baru) DAN input apa adanya
    // (pesanan cPanel lama: kode cPanel tidak menormalisasi nomor; ekspor Skill 25
    // hanya menormalisasi nomor seluler 08…).
    const params: (string | number)[] = [phoneNorm, phone];
    let sql =
      "SELECT id, order_code, recipient_name, fulfillment_method, status, total_estimate, created_at FROM orders WHERE phone IN (?, ?)";
    if (code) {
      sql += " AND order_code = ?";
      params.push(code);
    }
    sql += " ORDER BY created_at DESC, id DESC LIMIT 50";

    const orders = await query<OrderRow>(sql, params);
    if (orders.length === 0) {
      // Jatah tetap terpakai (kemungkinan menebak nomor/kode).
      return NextResponse.json({ orders: [] });
    }
    // Pencarian valid → kembalikan jatah pencarian ini saja (bukan reset), agar
    // tebakan gagal sebelumnya tetap terhitung — mencegah bypass dengan menyelipkan
    // pencarian nomor sendiri di antara tebakan nomor orang lain.
    await refundRateLimit(rlKey, rl.stamp);
    refunded = true;

    const ids = orders.map((o) => o.id);
    // Maks 50 pesanan (LIMIT di atas) — di bawah batas 100 parameter D1.
    const items = await query<OrderItemRow>(
      `SELECT order_id, product_name, variant, quantity, unit_price FROM order_items
        WHERE order_id IN (${placeholders(ids.length)})
        ORDER BY id ASC`,
      ids
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
    if (!refunded) await refundRateLimit(rlKey, rl.stamp);
    // Log ringkas (pesan singkat) — tanpa objek error mentah yang bisa memuat PII.
    console.error("POST /api/orders/lookup gagal:", dbErrorMessage(err));
    return NextResponse.json({ error: "Gagal mengambil data pesanan" }, { status: 500 });
  }
}
