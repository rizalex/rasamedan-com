/**
 * Buat/update akun admin. Jalankan: npm run seed:admin
 * Username & password bisa di-override lewat env ADMIN_USERNAME / ADMIN_PASSWORD.
 * Default: admin / admin123  (WAJIB diganti sebelum go-live!)
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
const password = process.env.ADMIN_PASSWORD ?? "admin123";

const config = {
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

try {
  const conn = await mysql.createConnection(config);
  const password_hash = hashPassword(password);
  await conn.execute(
    `INSERT INTO admin_users (username, password_hash) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    [username, password_hash]
  );
  console.log(`✅ Admin siap: username="${username}" password="${password}"`);
  console.log("   ⚠️  Ganti password ini sebelum deployment (set ADMIN_PASSWORD).");
  await conn.end();
  process.exit(0);
} catch (err) {
  console.error("❌ Gagal membuat admin:", err.code ?? "", err.message);
  process.exit(1);
}
