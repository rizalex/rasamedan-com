import { NextResponse } from "next/server";
import { dbErrorMessage, execute, query } from "@/lib/db";
import {
  assertAuthConfigured,
  clearAdminCookie,
  hashPassword,
  needsRehash,
  setAdminCookie,
  verifyLogin,
} from "@/lib/auth";
import { isSupportedHash } from "@/lib/password.mjs";
import { verifyCaptcha } from "@/lib/turnstile";
import { getClientIp, rateLimitKeyFromIp } from "@/lib/client-ip";
import {
  consumeRateLimit,
  refundRateLimit,
  resetRateLimit,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface AdminRow {
  id: number;
  password_hash: string;
  session_version: number;
}

/** POST /api/admin/auth — login admin. */
export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Content-Type harus application/json" }, { status: 415 });
  }
  let body: { username?: string; password?: string; captchaToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const captchaToken = String(body.captchaToken ?? "");
  const ip = getClientIp(req);
  const rlKey = `login:${rateLimitKeyFromIp(ip)}`;

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username dan password wajib diisi" },
      { status: 400 }
    );
  }
  // Batas panjang (username VARCHAR(50)) — cegah body raksasa membebani
  // hashing/DB atau memicu error DB yang berujung refund jatah.
  if (username.length > 50 || password.length > 256) {
    return NextResponse.json(
      { error: "Username atau password salah" },
      { status: 401 }
    );
  }

  // 1) Rate limit — blokir brute force sebelum kerja lain. Jatah diambil atomik
  // sebelum `await` apa pun agar burst paralel tidak lolos melewati batas 5.
  // Captcha/password gagal → jatah tetap terpakai; sukses → reset; error server
  // → dikembalikan.
  const rl = consumeRateLimit(rlKey);
  if (rl.limited) {
    const mins = Math.ceil(rl.retryAfterSec / 60);
    return NextResponse.json(
      {
        error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${mins} menit.`,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  // 2) Verifikasi Turnstile SEBELUM cek password (AC Skill 15).
  const captcha = await verifyCaptcha(captchaToken, ip, "login");
  if (!captcha.ok) {
    // 503 = salah konfigurasi server (bukan ulah klien) → jatah dikembalikan.
    if (captcha.status === 503) refundRateLimit(rlKey, rl.stamp);
    return NextResponse.json({ error: captcha.code, code: captcha.code }, { status: captcha.status });
  }

  try {
    // Gagal di sini (500 seragam) bila secret salah konfigurasi — sebelum cek
    // password, agar password benar vs salah tidak bisa dibedakan.
    await assertAuthConfigured();
    const rows = await query<AdminRow>(
      "SELECT id, password_hash, session_version FROM admin_users WHERE username = ? LIMIT 1",
      [username]
    );
    const admin = rows[0] ?? null;
    // Pesan error DAN biaya hashing sama untuk username/password salah
    // (hindari user enumeration, termasuk lewat waktu respons).
    if (!(await verifyLogin(password, admin?.password_hash ?? null))) {
      if (admin && !isSupportedHash(admin.password_hash)) {
        // Hash era cPanel (scrypt) tidak didukung lagi (Skill 26).
        console.warn("[auth] Hash password admin berformat lama — reset: npm run seed:admin -- --reset");
      }
      return NextResponse.json(
        { error: "Username atau password salah" },
        { status: 401 }
      );
    }
    resetRateLimit(rlKey);
    // Iterasi PBKDF2 dinaikkan sejak hash dibuat → perbarui diam-diam (password
    // sama, session_version tidak berubah). Gagal di sini tidak membatalkan login.
    // Compare-and-swap: hanya bila hash belum berubah sejak dibaca — login dengan
    // password LAMA yang berpacu dengan ganti password tidak boleh mengembalikan
    // password lama.
    if (needsRehash(admin!.password_hash)) {
      try {
        await execute(
          "UPDATE admin_users SET password_hash = ? WHERE id = ? AND password_hash = ?",
          [await hashPassword(password), admin!.id, admin!.password_hash]
        );
      } catch (err) {
        console.error("[auth] Gagal memperbarui hash password:", dbErrorMessage(err));
      }
    }
    await setAdminCookie(admin!.id, Number(admin!.session_version));
    return NextResponse.json({ ok: true });
  } catch (err) {
    refundRateLimit(rlKey, rl.stamp);
    console.error("POST /api/admin/auth gagal:", dbErrorMessage(err));
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}

/** DELETE /api/admin/auth — logout. */
export async function DELETE() {
  await clearAdminCookie();
  return NextResponse.json({ ok: true });
}
