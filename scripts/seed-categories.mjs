/**
 * Seed kategori awal (Skill 14): Kue, Kering, Sirup.
 * Jalankan:  npm run seed:categories
 *
 * Idempotent & aman untuk DB lama:
 *  - CREATE TABLE IF NOT EXISTS categories (tak perlu db:schema terpisah).
 *  - INSERT IGNORE (slug UNIQUE) → tidak menimpa kategori yang sudah diedit admin.
 *  - Backfill: masukkan juga kategori apa pun yang sudah dipakai produk tapi belum
 *    ada di tabel, agar tidak ada produk dengan kategori "yatim" (jaga AC3).
 */
import mysql from "mysql2/promise";

const config = {
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

const DEFAULTS = [
  { name: "Kue", slug: "kue" },
  { name: "Kering", slug: "kering" },
  { name: "Sirup", slug: "sirup" },
];

function titleCase(slug) {
  return slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

let conn;
try {
  conn = await mysql.createConnection(config);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name        VARCHAR(100) NOT NULL,
      slug        VARCHAR(100) NOT NULL,
      created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_categories_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  for (const c of DEFAULTS) {
    await conn.execute(
      "INSERT IGNORE INTO categories (name, slug) VALUES (?, ?)",
      [c.name, c.slug]
    );
  }

  // Backfill kategori yang dipakai produk tapi belum terdaftar.
  const [used] = await conn.query(
    `SELECT DISTINCT p.category AS slug
       FROM products p
       LEFT JOIN categories c ON c.slug = p.category
      WHERE c.id IS NULL AND p.category <> ''`
  );
  for (const row of used) {
    await conn.execute(
      "INSERT IGNORE INTO categories (name, slug) VALUES (?, ?)",
      [titleCase(row.slug), row.slug]
    );
    console.log(`   + backfill kategori dari produk: ${row.slug}`);
  }

  const [all] = await conn.query(
    "SELECT name, slug FROM categories ORDER BY id ASC"
  );
  console.log("✅ Seed kategori selesai. Kategori saat ini:");
  for (const c of all) console.log(`     - ${c.name} (${c.slug})`);

  await conn.end();
  process.exit(0);
} catch (err) {
  if (conn) await conn.end();
  console.error("❌ Seed kategori gagal.");
  console.error("   ", err.code ?? "", err.message);
  console.error("   Pastikan `.env` benar & database bisa diakses.");
  process.exit(1);
}
