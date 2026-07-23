/**
 * Terapkan schema `db/schema.sql` ke database MySQL yang dikonfigurasi di `.env`.
 * Jalankan:  npm run db:schema
 *
 * Untuk deploy cPanel, cara resmi tetap import via phpMyAdmin (lihat DEPLOYMENT.md).
 * Script ini memudahkan setup di development lokal.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import mysql from "mysql2/promise";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, "..", "db", "schema.sql");

const config = {
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  multipleStatements: true, // schema berisi banyak statement CREATE TABLE
};

try {
  const sql = await readFile(schemaPath, "utf8");
  console.log(`→ Menerapkan schema ke database "${config.database}"...`);
  const conn = await mysql.createConnection(config);
  await conn.query(sql);
  console.log("✅ Schema berhasil diterapkan (tabel dibuat jika belum ada).");
  await conn.end();
  process.exit(0);
} catch (err) {
  console.error("❌ Gagal menerapkan schema.");
  console.error("   ", err.code ?? "", err.message);
  process.exit(1);
}
