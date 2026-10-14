import { NextResponse } from "next/server";
import { dbErrorMessage, execute, query } from "@/lib/db";
import {
  getAdminSession,
  verifyPassword,
  hashPassword,
  clearAdminCookie,
} from "@/lib/auth";
import { consumeRateLimit, refundRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { getClientIp, rateLimitKeyFromIp } from "@/lib/client-ip";

export const dynamic = "force-dynamic";

// 12 (bukan 8): kompensasi iterasi PBKDF2 yang dibatasi CPU Workers (Skill 26);
// sama dengan syarat `npm run seed:admin`.
const MIN_PASSWORD_LEN = 12;

interface AdminRow {
  id: number;
  username: string;
  password_hash: string;
}

/**
 * PUT /api/admin/account — admin mengubah username &/atau password sendiri.
 *
 * Aturan (Skill 16):
 * - Wajib menyertakan password saat ini; jika salah, TOLAK seluruh perubahan.
 * - Username baru opsional (tidak boleh menabrak admin lain).
 * - Password baru opsional; jika diisi harus >= 12 karakter & cocok dgn konfirmasi.
 * - Setelah password berubah, sesi lama di-invalidasi → admin harus login ulang.
 */
export async function PUT(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let body: {
    currentPassword?: string;
    newUsername?: string;
    newPassword?: string;
    confirmPassword?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const currentPassword = String(body.currentPassword ?? "");
  const newUsername = String(body.newUsername ?? "").trim();
  const newPassword = String(body.newPassword ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");

  // Batas sejalan dengan login — cegah hashing string raksasa.
  if (currentPassword.length > 256) {
    return NextResponse.json(
      { error: "Password saat ini salah" },
      { status: 401 }
    );
  }
  if (!currentPassword) {
    return NextResponse.json(
      { error: "Password saat ini wajib diisi" },
      { status: 400 }
    );
  }

  // Batasi tebakan "password saat ini" (mis. pemegang cookie curian yang ingin
  // mengetahui password admin): 5 salah / 15 menit per akun PER JARINGAN, sama
  // dengan login. IP ikut di kunci agar pencuri cookie tidak bisa mengunci admin
  // asli dari ganti password (satu-satunya cara di UI mencabut sesi curian).
  const rlKey = `account:${session.sub}:${rateLimitKeyFromIp(getClientIp(req))}`;
  const rl = await consumeRateLimit(rlKey);
  if (rl.limited) {
    const mins = Math.ceil(rl.retryAfterSec / 60);
    return NextResponse.json(
      { error: `Terlalu banyak percobaan. Coba lagi dalam ${mins} menit.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const rows = await query<AdminRow>(
      "SELECT id, username, password_hash FROM admin_users WHERE id = ? LIMIT 1",
      [session.sub]
    );
    if (rows.length === 0) {
      // Sesi valid tapi akun tidak ada lagi — anggap tidak terautentikasi.
      await clearAdminCookie();
      return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
    }
    const admin = rows[0];

    // Verifikasi password saat ini SEBELUM memproses field lain.
    if (!(await verifyPassword(currentPassword, admin.password_hash))) {
      return NextResponse.json(
        { error: "Password saat ini salah" },
        { status: 401 }
      );
    }
    await resetRateLimit(rlKey);

    // Kumpulkan perubahan (username &/atau password).
    const setClauses: string[] = [];
    const params: (string | number)[] = [];
    let usernameChanged = false;
    let passwordChanged = false;

    if (newUsername && newUsername !== admin.username) {
      // Selaras dengan kolom VARCHAR(50) dan batas di login.
      if (newUsername.length > 50) {
        return NextResponse.json(
          { error: "Username maksimal 50 karakter" },
          { status: 400 }
        );
      }
      const dupe = await query<AdminRow>(
        "SELECT id FROM admin_users WHERE username = ? AND id <> ? LIMIT 1",
        [newUsername, admin.id]
      );
      if (dupe.length > 0) {
        return NextResponse.json(
          { error: "Username sudah dipakai" },
          { status: 409 }
        );
      }
      setClauses.push("username = ?");
      params.push(newUsername);
      usernameChanged = true;
    }

    if (newPassword) {
      if (newPassword.length < MIN_PASSWORD_LEN) {
        return NextResponse.json(
          { error: `Password baru minimal ${MIN_PASSWORD_LEN} karakter` },
          { status: 400 }
        );
      }
      // Login menolak password > 256 karakter; tolak juga di sini agar admin
      // tidak mengunci dirinya sendiri.
      if (newPassword.length > 256) {
        return NextResponse.json(
          { error: "Password baru maksimal 256 karakter" },
          { status: 400 }
        );
      }
      if (newPassword !== confirmPassword) {
        return NextResponse.json(
          { error: "Konfirmasi password baru tidak cocok" },
          { status: 400 }
        );
      }
      // Naikkan versi sesi dalam UPDATE yang sama (atomik): semua sesi admin di
      // perangkat mana pun langsung tidak berlaku (Skill 21.2 no. 5).
      setClauses.push("password_hash = ?", "session_version = session_version + 1");
      params.push(await hashPassword(newPassword));
      passwordChanged = true;
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada perubahan untuk disimpan" },
        { status: 400 }
      );
    }

    params.push(admin.id);
    await execute(
      `UPDATE admin_users SET ${setClauses.join(", ")} WHERE id = ?`,
      params
    );

    // Setelah ganti password, paksa login ulang di perangkat ini juga (sesi di
    // perangkat lain sudah gugur lewat session_version).
    if (passwordChanged) {
      await clearAdminCookie();
    }

    return NextResponse.json({ ok: true, usernameChanged, passwordChanged });
  } catch (err) {
    await refundRateLimit(rlKey, rl.stamp);
    // Log ringkas: jangan log objek error utuh (parameter memuat hash password baru).
    console.error("PUT /api/admin/account gagal:", dbErrorMessage(err));
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}
