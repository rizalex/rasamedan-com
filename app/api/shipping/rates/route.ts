import { NextResponse } from "next/server";
import { getClientIp, rateLimitKeyFromIp } from "@/lib/client-ip";
import { consumeRateLimit, refundRateLimit } from "@/lib/rate-limit";
import { verifyCaptcha } from "@/lib/turnstile";
import { dbErrorMessage } from "@/lib/db";
import { parseIncomingItems, resolveCheckoutItems, totalWeightGrams } from "@/lib/checkout-items";
import { getDisabledCourierCodes, isApiCourierAllowed } from "@/lib/courier-settings";
import {
  describeDistrict,
  fetchRates,
  getShippingConfig,
  isCircuitOpen,
  readCachedRates,
  weightBucket,
  type CachedRates,
} from "@/lib/shipping";

/**
 * Estimasi ongkir per kurir/layanan (Skill 31.5).
 *   POST /api/shipping/rates  { districtCode, items: [{productId, variant, quantity}], captchaToken }
 *
 * Biaya api.co.id Rp 5 per panggilan sukses, jadi berlapis:
 * cache 12 jam (hit: tanpa captcha & tanpa biaya) → circuit breaker →
 * Turnstile (action "shipping-rates") → 5 cek/jam per IP → batas harian global
 * (SHIPPING_RATES_DAILY_CAP, default 100). Berat dihitung dari DB, bukan klien.
 * Estimasi tidak tersedia → `{ available: false, reason }` (HTTP 200): checkout
 * tetap jalan, ongkir dikonfirmasi via WhatsApp.
 */

export const dynamic = "force-dynamic";

const REQUEST_LIMIT = 30; // request cache-miss per IP (sebelum captcha)
const REQUEST_WINDOW_MS = 10 * 60 * 1000;
const QUOTE_LIMIT_PER_IP = 5; // panggilan upstream per IP per jam (keputusan pemilik 31a)
const QUOTE_WINDOW_MS = 60 * 60 * 1000;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const CAPTCHA_FAIL_LIMIT = 30;

type Reason = "DISABLED" | "INVALID_DISTRICT" | "WEIGHT_UNKNOWN" | "TOO_HEAVY" | "NOT_SERVED" | "UNAVAILABLE" | "DAILY_LIMIT";

const unavailable = (reason: Reason) => NextResponse.json({ available: false, reason });

function tooMany(retryAfterSec: number) {
  return NextResponse.json(
    { available: false, reason: "RATE_LIMITED", code: "RATE_LIMITED" },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

function ratesResponse(weightGrams: number, value: CachedRates, disabled: Set<string>) {
  // Kurir yang dinonaktifkan admin (Skill 32) disaring saat dibaca, bukan saat
  // disimpan ke cache — perubahan pengaturan langsung berlaku.
  const rates = value.rates.filter((r) => isApiCourierAllowed(r.courierCode, disabled));
  if (rates.length === 0) return unavailable("NOT_SERVED");
  return NextResponse.json({
    available: true,
    weightGrams,
    rates,
    quotedAt: value.fetchedAt,
  });
}

export async function POST(req: Request) {
  // Hanya JSON (anti-CSRF, sama seperti /api/orders).
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Content-Type harus application/json" }, { status: 415 });
  }
  const cfg = getShippingConfig();
  if (!cfg.enabled) return unavailable("DISABLED");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const ipKey = rateLimitKeyFromIp(ip);
  const parsed = parseIncomingItems(body.items);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const district = await describeDistrict(body.districtCode);
    if (!district) return unavailable("INVALID_DISTRICT");

    const resolved = await resolveCheckoutItems(parsed.items);
    if (!resolved.ok) {
      const { code, error, productId, variant } = resolved;
      return NextResponse.json({ error, code, productId, variant }, { status: 409 });
    }
    const grams = totalWeightGrams(resolved.items);
    if (grams === null) return unavailable("WEIGHT_UNKNOWN");
    const bucket = weightBucket(grams);
    if (bucket === null) return unavailable("TOO_HEAVY");

    const disabled = await getDisabledCourierCodes();
    // Cache hit: tanpa captcha, tanpa biaya.
    const cached = await readCachedRates(cfg.origin, district.code, bucket);
    if (cached) return ratesResponse(bucket, cached, disabled);

    if (await isCircuitOpen()) return unavailable("UNAVAILABLE");

    // Mulai di sini ada penulisan D1 (rate limit): hanya jalur miss, agar request
    // sampah/cache hit tidak bisa menghabiskan kuota tulis D1 (audit Skill 31).
    const reqRl = await consumeRateLimit(`shiprates:${ipKey}`, REQUEST_LIMIT, REQUEST_WINDOW_MS);
    if (reqRl.limited) return tooMany(reqRl.retryAfterSec);

    // Captcha hanya untuk cek baru (miss). Jatah "captcha gagal" diambil dulu
    // (anti burst), dikembalikan bila captcha lolos.
    const captchaKey = `shipcaptcha:${ipKey}`;
    const captchaRl = await consumeRateLimit(captchaKey, CAPTCHA_FAIL_LIMIT, QUOTE_WINDOW_MS);
    if (captchaRl.limited) return tooMany(captchaRl.retryAfterSec);
    const captcha = await verifyCaptcha(String(body.captchaToken ?? "").trim(), ip, "shipping-rates");
    if (!captcha.ok) {
      if (captcha.status === 503) await refundRateLimit(captchaKey, captchaRl.stamp);
      return NextResponse.json({ error: captcha.code, code: captcha.code }, { status: captcha.status });
    }
    await refundRateLimit(captchaKey, captchaRl.stamp);

    const ipQuota = await consumeRateLimit(`shipquote:${ipKey}`, QUOTE_LIMIT_PER_IP, QUOTE_WINDOW_MS);
    if (ipQuota.limited) return tooMany(ipQuota.retryAfterSec);
    const daily = await consumeRateLimit("shipquote:all", cfg.dailyCap, DAILY_WINDOW_MS);
    if (daily.limited) {
      await refundRateLimit(`shipquote:${ipKey}`, ipQuota.stamp);
      console.warn("[shipping] batas harian cek ongkir tercapai");
      return unavailable("DAILY_LIMIT");
    }

    const fetched = await fetchRates(cfg.origin, district.code, bucket);
    if (!fetched.ok) {
      // Panggilan gagal tidak ditagih api.co.id → jatah dikembalikan.
      await refundRateLimit(`shipquote:${ipKey}`, ipQuota.stamp);
      await refundRateLimit("shipquote:all", daily.stamp);
      return unavailable("UNAVAILABLE");
    }
    return ratesResponse(bucket, fetched.value, disabled);
  } catch (err) {
    console.error("POST /api/shipping/rates gagal:", dbErrorMessage(err));
    return unavailable("UNAVAILABLE");
  }
}
