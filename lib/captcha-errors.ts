/**
 * Peta kode error captcha dari server (lib/turnstile.ts) → kunci i18n.
 * Aman untuk klien (tanpa dependensi). Server mengirim kode, bukan teks, agar
 * pesan tampil sesuai bahasa aktif.
 */
/** Action Turnstile per form (dicek server agar token satu form tidak dipakai di form lain). */
export type CaptchaAction = "login" | "check-order" | "checkout" | "account" | "shipping-rates";

export function captchaErrorKey(code: unknown): string | null {
  switch (code) {
    case "CAPTCHA_REQUIRED":
      return "captcha.required";
    case "CAPTCHA_FAILED":
      return "captcha.failed";
    case "CAPTCHA_UNAVAILABLE":
      return "captcha.unavailable";
    default:
      return null;
  }
}
