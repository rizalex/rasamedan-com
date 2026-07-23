/**
 * Verifikasi Google reCAPTCHA v2 ("I'm not a robot") di server (Skill 15).
 *
 * Aktif hanya bila `RECAPTCHA_SECRET_KEY` diisi di `.env`. Bila kosong, verifikasi
 * dilewati (memudahkan dev tanpa key). Untuk produksi WAJIB diisi dengan key asli.
 * Site key & secret key harus diisi berpasangan (lihat .env.example).
 */

const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

/** reCAPTCHA aktif di server bila secret key dikonfigurasi. */
export function isRecaptchaEnabled(): boolean {
  return !!process.env.RECAPTCHA_SECRET_KEY;
}

/** Site key untuk widget di client (dikirim dari server ke halaman login). */
export function getRecaptchaSiteKey(): string {
  return process.env.RECAPTCHA_SITE_KEY ?? "";
}

/**
 * Verifikasi token reCAPTCHA dari client ke Google.
 * - Bila reCAPTCHA tidak dikonfigurasi → lolos (mode dev).
 * - Bila dikonfigurasi tapi token kosong → gagal (JANGAN lanjut cek password).
 */
export async function verifyRecaptcha(
  token: string,
  remoteIp?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return { ok: true };
  if (!token) {
    return { ok: false, error: "Mohon centang reCAPTCHA terlebih dahulu." };
  }
  try {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteIp && remoteIp !== "local") params.set("remoteip", remoteIp);
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = (await res.json()) as { success?: boolean };
    if (!data.success) {
      return { ok: false, error: "Verifikasi reCAPTCHA gagal. Silakan coba lagi." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Tidak bisa memverifikasi reCAPTCHA. Coba lagi." };
  }
}
