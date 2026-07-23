import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import { verifyPassword, setAdminCookie, clearAdminCookie } from "@/lib/auth";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { checkRateLimit, recordFailure, resetRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface AdminRow extends RowDataPacket {
  id: number;
  password_hash: string;
}

/** Alamat IP client (di belakang proxy/Passenger memakai header X-Forwarded-For). */
function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/** POST /api/admin/auth — login admin. */
export async function POST(req: Request) {
  let body: { username?: string; password?: string; recaptchaToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const recaptchaToken = String(body.recaptchaToken ?? "");
  const ip = getClientIp(req);
  const rlKey = `login:${ip}`;

  // 1) Rate limit — blokir brute force sebelum kerja lain.
  const rl = checkRateLimit(rlKey);
  if (rl.limited) {
    const mins = Math.ceil(rl.retryAfterSec / 60);
    return NextResponse.json(
      {
        error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${mins} menit.`,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username dan password wajib diisi" },
      { status: 400 }
    );
  }

  // 2) Verifikasi reCAPTCHA SEBELUM cek password (AC Skill 15).
  const captcha = await verifyRecaptcha(recaptchaToken, ip);
  if (!captcha.ok) {
    recordFailure(rlKey);
    return NextResponse.json({ error: captcha.error }, { status: 400 });
  }

  try {
    const [rows] = await pool.query<AdminRow[]>(
      "SELECT id, password_hash FROM admin_users WHERE username = ? LIMIT 1",
      [username]
    );
    // Pesan error sama untuk username/password salah (hindari user enumeration).
    if (rows.length === 0 || !verifyPassword(password, rows[0].password_hash)) {
      recordFailure(rlKey);
      return NextResponse.json(
        { error: "Username atau password salah" },
        { status: 401 }
      );
    }
    resetRateLimit(rlKey);
    await setAdminCookie(rows[0].id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/admin/auth gagal:", err);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}

/** DELETE /api/admin/auth — logout. */
export async function DELETE() {
  await clearAdminCookie();
  return NextResponse.json({ ok: true });
}
