/**
 * Buat akun admin di D1. Jalankan: ADMIN_PASSWORD=<kuat> npm run seed:admin
 * Username lewat env ADMIN_USERNAME (default "admin"). ADMIN_PASSWORD WAJIB diisi
 * (minimal 12 karakter) — tidak ada password default, agar akun admin tidak pernah
 * dibuat dengan password yang tertulis publik di repo.
 *
 * Target: D1 lokal secara default; D1 production dengan `-- --remote`.
 *
 * PENGAMAN: bila username sudah ada, password TIDAK ditimpa (agar password yang
 * sudah diganti lewat halaman Pengaturan tidak kembali ke default). Untuk reset
 * password secara sengaja: ADMIN_PASSWORD=... npm run seed:admin -- --reset
 * (--reset wajib disertai ADMIN_PASSWORD; password tidak pernah dicetak ke log).
 *
 * Hashing memakai modul yang SAMA dengan aplikasi (lib/password.mjs, PBKDF2
 * Web Crypto) — format `pbkdf2:iter:salt:hash` (Skill 26). Dipakai juga untuk
 * reset password admin saat migrasi data (Skill 25): hash scrypt era cPanel
 * tidak bisa dipakai login lagi.
 */
import { hashPassword } from "../lib/password.mjs";
import { d1ExecSql, d1Query, sqlValue, targetFromArgs } from "./lib/d1.mjs";

const username = (process.env.ADMIN_USERNAME ?? "admin").trim();
const password = process.env.ADMIN_PASSWORD ?? "";
const reset = process.argv.includes("--reset");
const target = targetFromArgs();

if (password.length < 12) {
  console.error("❌ ADMIN_PASSWORD wajib diisi, minimal 12 karakter.");
  console.error("   Contoh: ADMIN_PASSWORD='<password-kuat>' npm run seed:admin");
  process.exit(1);
}
// Batas sama dengan login (/api/admin/auth) agar akun bisa dipakai login.
if (password.length > 256) {
  console.error("❌ ADMIN_PASSWORD maksimal 256 karakter.");
  process.exit(1);
}
if (!username || username.length > 50) {
  console.error("❌ ADMIN_USERNAME wajib 1–50 karakter.");
  process.exit(1);
}

try {
  const rows = d1Query(
    `SELECT id FROM admin_users WHERE username = ${sqlValue(username)} LIMIT 1`,
    target
  );
  if (rows.length > 0 && !reset) {
    console.log(`ℹ️  Admin "${username}" sudah ada — password tidak diubah.`);
    console.log("   Untuk reset: ADMIN_PASSWORD=... npm run seed:admin -- --reset");
    process.exit(0);
  }
  const passwordHash = await hashPassword(password);
  if (rows.length > 0) {
    // Naikkan session_version: reset password (mis. karena bocor) harus mencabut
    // semua sesi yang ada, sama seperti ganti password dari halaman Pengaturan.
    d1ExecSql(
      `UPDATE admin_users SET password_hash = ${sqlValue(passwordHash)}, session_version = session_version + 1 WHERE username = ${sqlValue(username)};\n`,
      target
    );
    console.log(`✅ Password admin "${username}" direset (${target}).`);
  } else {
    d1ExecSql(
      `INSERT INTO admin_users (username, password_hash) VALUES (${sqlValue(username)}, ${sqlValue(passwordHash)});\n`,
      target
    );
    console.log(`✅ Admin "${username}" dibuat (${target}).`);
  }
} catch (err) {
  console.error("❌ Gagal membuat admin:", err?.message ?? err);
  console.error("   Pastikan migrasi sudah diterapkan: npm run db:migrate");
  process.exit(1);
}
