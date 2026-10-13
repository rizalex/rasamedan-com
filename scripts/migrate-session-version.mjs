/**
 * Migrasi Skill 21.2 no. 5: tambahkan kolom `admin_users.session_version`.
 * Wajib dijalankan pada DB lama — tanpa kolom ini login & halaman admin ditolak
 * (fail-closed). Jalankan:  npm run db:migrate:session
 *
 * Idempotent: cek information_schema dulu, ADD COLUMN hanya bila belum ada.
 * Semua admin perlu login ulang sekali setelah update (token lama tanpa versi).
 */
import mysql from "mysql2/promise";

const config = {
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

let conn;
try {
  conn = await mysql.createConnection(config);
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admin_users' AND COLUMN_NAME = 'session_version' LIMIT 1`,
    [config.database]
  );
  if (rows.length > 0) {
    console.log("• admin_users.session_version sudah ada — dilewati.");
  } else {
    await conn.query(
      "ALTER TABLE admin_users ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER password_hash"
    );
    console.log("✓ Kolom admin_users.session_version ditambahkan.");
  }
  await conn.end();
  process.exit(0);
} catch (err) {
  if (conn) await conn.end();
  console.error("❌ Migrasi gagal:", err.code ?? "", err.message);
  process.exit(1);
}
