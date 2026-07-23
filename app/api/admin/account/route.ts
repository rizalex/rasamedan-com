import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import {
  getAdminSession,
  verifyPassword,
  hashPassword,
  clearAdminCookie,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const MIN_PASSWORD_LEN = 8;

interface AdminRow extends RowDataPacket {
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
 * - Password baru opsional; jika diisi harus >= 8 karakter & cocok dgn konfirmasi.
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

  if (!currentPassword) {
    return NextResponse.json(
      { error: "Password saat ini wajib diisi" },
      { status: 400 }
    );
  }

  try {
    const [rows] = await pool.query<AdminRow[]>(
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
    if (!verifyPassword(currentPassword, admin.password_hash)) {
      return NextResponse.json(
        { error: "Password saat ini salah" },
        { status: 401 }
      );
    }

    // Kumpulkan perubahan (username &/atau password).
    const setClauses: string[] = [];
    const params: (string | number)[] = [];
    let usernameChanged = false;
    let passwordChanged = false;

    if (newUsername && newUsername !== admin.username) {
      const [dupe] = await pool.query<AdminRow[]>(
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
      if (newPassword !== confirmPassword) {
        return NextResponse.json(
          { error: "Konfirmasi password baru tidak cocok" },
          { status: 400 }
        );
      }
      setClauses.push("password_hash = ?");
      params.push(hashPassword(newPassword));
      passwordChanged = true;
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada perubahan untuk disimpan" },
        { status: 400 }
      );
    }

    params.push(admin.id);
    await pool.query(
      `UPDATE admin_users SET ${setClauses.join(", ")} WHERE id = ?`,
      params
    );

    // Setelah ganti password, paksa login ulang (invalidasi sesi lama).
    if (passwordChanged) {
      await clearAdminCookie();
    }

    return NextResponse.json({ ok: true, usernameChanged, passwordChanged });
  } catch (err) {
    console.error("PUT /api/admin/account gagal:", err);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}
