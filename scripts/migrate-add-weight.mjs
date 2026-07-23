/**
 * Migrasi Skill 13: tambahkan kolom `weight_grams` ke `products` & `product_variants`.
 * Untuk DB yang sudah terlanjur dibuat sebelum kolom berat ada.
 * Jalankan:  npm run db:migrate
 *
 * Idempotent: cek information_schema dulu, ADD COLUMN hanya bila belum ada.
 * Setelah migrasi, jalankan `npm run seed` untuk mengisi berat produk dummy.
 */
import mysql from "mysql2/promise";

const config = {
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [config.database, table, column]
  );
  return rows.length > 0;
}

let conn;
try {
  conn = await mysql.createConnection(config);

  if (await columnExists(conn, "products", "weight_grams")) {
    console.log("• products.weight_grams sudah ada — dilewati.");
  } else {
    await conn.query(
      "ALTER TABLE products ADD COLUMN weight_grams INT UNSIGNED NOT NULL DEFAULT 0 AFTER price"
    );
    console.log("✓ Kolom products.weight_grams ditambahkan.");
  }

  if (await columnExists(conn, "product_variants", "weight_grams")) {
    console.log("• product_variants.weight_grams sudah ada — dilewati.");
  } else {
    await conn.query(
      "ALTER TABLE product_variants ADD COLUMN weight_grams INT UNSIGNED NOT NULL DEFAULT 0 AFTER price_delta"
    );
    console.log("✓ Kolom product_variants.weight_grams ditambahkan.");
  }

  console.log("✅ Migrasi berat selesai. Jalankan `npm run seed` untuk mengisi berat produk dummy.");
  await conn.end();
  process.exit(0);
} catch (err) {
  if (conn) await conn.end();
  console.error("❌ Migrasi gagal.");
  console.error("   ", err.code ?? "", err.message);
  console.error("   Pastikan `.env` benar & schema dasar sudah diterapkan (npm run db:schema).");
  process.exit(1);
}
