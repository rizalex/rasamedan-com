/**
 * Buat akun admin. Jalankan: ADMIN_PASSWORD=<kuat> npm run seed:admin
 * Username lewat env ADMIN_USERNAME (default "admin"). ADMIN_PASSWORD WAJIB diisi
 * (minimal 12 karakter) — tidak ada password default, agar akun admin tidak pernah
 * dibuat dengan password yang tertulis publik di repo.
 *
 * PENGAMAN: bila username sudah ada, password TIDAK ditimpa (agar password yang
 * sudah diganti lewat halaman Pengaturan tidak kembali ke default). Untuk reset
 * password secara sengaja: ADMIN_PASSWORD=... npm run seed:admin -- --reset
 * (--reset wajib disertai ADMIN_PASSWORD; password tidak pernah dicetak ke log).
 *
 * Hashing memakai scrypt (node:crypto) — format `saltHex:hashHex`, sama persis
 * dengan lib/auth.ts verifyPassword.
 */
import { randomBytes, scryptSync } from "node:crypto";
import mysql from "mysql2/promise";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const username = process.env.ADMIN_USERNAME ?? "admin";
const password = process.env.ADMIN_PASSWORD ?? "";

const config = {
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

const reset = process.argv.includes("--reset");
if (password.length < 12) {
  console.error("❌ ADMIN_PASSWORD wajib diisi, minimal 12 karakter.");
  console.error("   Contoh: ADMIN_PASSWORD='<password-kuat>' npm run seed:admin");
  process.exit(1);
}

try {
  const conn = await mysql.createConnection(config);
  const [rows] = await conn.execute(
    "SELECT id FROM admin_users WHERE username = ? LIMIT 1",
    [username]
  );
  if (rows.length > 0 && !reset) {
    console.log(`ℹ️  Admin "${username}" sudah ada — password tidak diubah.`);
    console.log("   Untuk reset: ADMIN_PASSWORD=... npm run seed:admin -- --reset");
    await conn.end();
    process.exit(0);
  }
  const password_hash = hashPassword(password);
  if (rows.length > 0) {
    // Naikkan session_version: reset password (mis. karena bocor) harus mencabut
    // semua sesi yang ada, sama seperti ganti password dari halaman Pengaturan.
    await conn.execute(
      "UPDATE admin_users SET password_hash = ?, session_version = session_version + 1 WHERE username = ?",
      [password_hash, username]
    );
    console.log(`✅ Password admin "${username}" direset.`);
  } else {
    await conn.execute(
      "INSERT INTO admin_users (username, password_hash) VALUES (?, ?)",
      [username, password_hash]
    );
    console.log(`✅ Admin "${username}" dibuat.`);
  }
  await conn.end();
  process.exit(0);
} catch (err) {
  console.error("❌ Gagal membuat admin:", err.code ?? "", err.message);
  process.exit(1);
}
