/**
 * Cloudflare Turnstile — verifikasi captcha di server (Skill 15, 21.2 no. 3).
 * Menggantikan captcha Google versi lama. Server-only (membaca secret).
 *
 * Aturan:
 * - Production WAJIB: tanpa TURNSTILE_SECRET_KEY request ditolak (fail-closed),
 *   tidak dilewati diam-diam. Mode lewati hanya di development.
 * - Test key resmi Cloudflare (1x…/2x…/3x…) meloloskan/menolak token apa pun,
 *   jadi di production ditolak kecuali ALLOW_TEST_CAPTCHA=1 (hanya .dev.vars untuk
 *   preview lokal). Key asli di production wajib NEXT_PUBLIC_SITE_URL non-localhost.
 * - Urutan di route tetap: rate limit → captcha → DB/kredensial.
 * - Token & secret tidak pernah dicatat di log.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 8000;
const MAX_TOKEN_LENGTH = 2048;

export type CaptchaAction = "login" | "check-order" | "checkout";
export type CaptchaErrorCode = "CAPTCHA_REQUIRED" | "CAPTCHA_FAILED" | "CAPTCHA_UNAVAILABLE";
export type CaptchaResult =
  | { ok: true }
  | { ok: false; code: CaptchaErrorCode; status: 400 | 503 };

const isProduction = () => process.env.NODE_ENV === "production";
const isTestSecret = (secret: string) => /^[123]x0{10,}/.test(secret);

/** Hostname situs dari NEXT_PUBLIC_SITE_URL (untuk cek hostname token). */
function siteHostname(): string | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").hostname.toLowerCase();
  } catch {
    return null;
  }
}

const isLocalHost = (host: string | null) =>
  host === "localhost" || host === "127.0.0.1" || host === "[::1]";

/** Hostname token dianggap cocok, termasuk varian apex ↔ www. */
function hostnameMatches(got: string, expected: string): boolean {
  const strip = (h: string) => h.toLowerCase().replace(/^www\./, "");
  return strip(got) === strip(expected);
}

/** Captcha wajib? Selalu di production; di development hanya bila secret diisi. */
export function isCaptchaEnabled(): boolean {
  return isProduction() || Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/** Site key untuk widget (dibaca saat request, dikirim sebagai prop dari server). */
export function getCaptchaSiteKey(): string {
  return process.env.TURNSTILE_SITE_KEY ?? "";
}

let warnedDevSkip = false;

/** Verifikasi token Turnstile dari klien. */
export async function verifyCaptcha(
  token: string,
  remoteIp: string | null,
  expectedAction?: CaptchaAction
): Promise<CaptchaResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY ?? "";
  if (!secret) {
    if (isProduction()) {
      console.error("[turnstile] TURNSTILE_SECRET_KEY kosong di production — request ditolak.");
      return { ok: false, code: "CAPTCHA_UNAVAILABLE", status: 503 };
    }
    if (!warnedDevSkip) {
      warnedDevSkip = true;
      console.warn("[turnstile] Secret kosong — captcha dilewati (development saja).");
    }
    return { ok: true };
  }

  const testSecret = isTestSecret(secret);
  // Test key meloloskan token apa pun → di production DITOLAK, kecuali flag
  // runtime eksplisit ALLOW_TEST_CAPTCHA=1 (hanya diisi di .dev.vars untuk
  // `npm run preview` lokal). Sengaja tidak bergantung pada NEXT_PUBLIC_SITE_URL:
  // nilai itu di-inline saat build dan bisa saja masih localhost saat deploy.
  if (testSecret && isProduction() && process.env.ALLOW_TEST_CAPTCHA !== "1") {
    console.error("[turnstile] Test key dipakai di production — request ditolak.");
    return { ok: false, code: "CAPTCHA_UNAVAILABLE", status: 503 };
  }
  // Key asli di production butuh hostname situs yang valid untuk dicocokkan.
  const expectedHost = siteHostname();
  if (!testSecret && isProduction() && (!expectedHost || isLocalHost(expectedHost))) {
    console.error("[turnstile] NEXT_PUBLIC_SITE_URL kosong/localhost saat build — request ditolak.");
    return { ok: false, code: "CAPTCHA_UNAVAILABLE", status: 503 };
  }

  if (!token) return { ok: false, code: "CAPTCHA_REQUIRED", status: 400 };
  if (token.length > MAX_TOKEN_LENGTH) return { ok: false, code: "CAPTCHA_FAILED", status: 400 };

  const params = new URLSearchParams({ secret, response: token });
  if (remoteIp) params.set("remoteip", remoteIp);

  let data: {
    success?: boolean;
    hostname?: string;
    action?: string;
    "error-codes"?: string[];
  };
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("[turnstile] siteverify HTTP", res.status);
      return { ok: false, code: "CAPTCHA_FAILED", status: 400 };
    }
    data = await res.json();
  } catch (err) {
    const e = err as { name?: string };
    console.error("[turnstile] siteverify gagal:", e.name ?? "error");
    return { ok: false, code: "CAPTCHA_FAILED", status: 400 };
  }

  if (data.success !== true) {
    console.warn("[turnstile] ditolak:", (data["error-codes"] ?? []).join(","));
    return { ok: false, code: "CAPTCHA_FAILED", status: 400 };
  }

  // Test key mengembalikan hostname/action dummy → cek ini hanya untuk key asli.
  if (!testSecret) {
    if (expectedHost && !hostnameMatches(data.hostname ?? "", expectedHost)) {
      console.warn("[turnstile] hostname tidak cocok:", data.hostname ?? "(kosong)");
      return { ok: false, code: "CAPTCHA_FAILED", status: 400 };
    }
    // Token satu form tidak boleh dipakai di form lain; action kosong (widget
    // dirender tanpa action) juga ditolak.
    if (expectedAction && data.action !== expectedAction) {
      console.warn("[turnstile] action tidak cocok:", data.action);
      return { ok: false, code: "CAPTCHA_FAILED", status: 400 };
    }
  }
  return { ok: true };
}
