/**
 * Perbaiki tabel `order_items` yang tablespace InnoDB-nya hilang.
 * Jalankan: npm run db:repair
 *
 * Gejala: query apa pun ke order_items gagal dengan
 *   "Table 'toko_medan.order_items' doesn't exist in engine" (errno 1932),
 * dan di information_schema.tables kolom ENGINE = NULL.
 *
 * Penyebab umum: MariaDB/XAMPP crash atau folder data disalin sehingga file
 * data `.ibd` tabel ini hilang, tetapi definisinya masih tercatat. Karena itu
 * `npm run db:schema` (CREATE TABLE IF NOT EXISTS) TIDAK bisa memperbaiki —
 * tabel dianggap "sudah ada" lalu dilewati. Script ini DROP definisi yatim itu
 * lalu membuat ulang tabelnya (kosong) dari DDL yang identik dengan db/schema.sql.
 *
 * CATATAN: baris order_items lama tidak bisa dipulihkan (datanya memang hilang).
 * Tabel `orders` tetap utuh; pesanan lama hanya kehilangan rincian item.
 */
import mysql from "mysql2/promise";

// DDL identik dengan db/schema.sql (source of truth).
const CREATE_ORDER_ITEMS = `
CREATE TABLE order_items (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id     INT UNSIGNED NOT NULL,
  product_id   INT UNSIGNED NULL,
  product_name VARCHAR(191) NOT NULL,
  variant      VARCHAR(100) NULL,
  quantity     INT UNSIGNED NOT NULL DEFAULT 1,
  unit_price   INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_items_order (order_id),
  KEY idx_items_product (product_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id)
    REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;`;

const db = await mysql.createConnection({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

async function tryExec(label, sql) {
  try {
    await db.query(sql);
    console.log(`✓ ${label}`);
    return true;
  } catch (e) {
    console.log(`✗ ${label}: ${e.errno ?? ""} ${e.sqlMessage ?? e.message}`);
    return false;
  }
}

try {
  // Cek dulu apakah tabel memang bermasalah (ENGINE = NULL) atau tidak ada.
  const [rows] = await db.query(
    "SELECT engine AS eng FROM information_schema.tables WHERE table_schema = ? AND table_name = 'order_items'",
    [process.env.DB_NAME]
  );
  const engine = rows[0]?.eng ?? null;
  if (rows.length > 0 && engine) {
    // Tabel sehat — pastikan benar-benar bisa di-query.
    try {
      await db.query("SELECT 1 FROM order_items LIMIT 1");
      console.log(`order_items sudah sehat (engine=${engine}). Tidak ada yang diperbaiki.`);
      await db.end();
      process.exit(0);
    } catch {
      console.log(`order_items terdaftar (engine=${engine}) tapi tidak bisa di-query — melanjutkan perbaikan.`);
    }
  }

  await db.query("SET FOREIGN_KEY_CHECKS = 0");

  let dropped = await tryExec("DROP TABLE IF EXISTS order_items", "DROP TABLE IF EXISTS order_items");
  if (!dropped) {
    // Fallback: lepas tablespace yatim lalu DROP lagi.
    await tryExec("ALTER TABLE order_items DISCARD TABLESPACE", "ALTER TABLE order_items DISCARD TABLESPACE");
    dropped = await tryExec("DROP TABLE IF EXISTS order_items (retry)", "DROP TABLE IF EXISTS order_items");
  }

  const created = await tryExec("CREATE TABLE order_items", CREATE_ORDER_ITEMS);
  await db.query("SET FOREIGN_KEY_CHECKS = 1");

  if (!created) {
    console.error("❌ Gagal membuat ulang order_items. Periksa error di atas.");
    await db.end();
    process.exit(1);
  }

  const [r] = await db.query("SELECT COUNT(*) AS c FROM order_items");
  console.log(`✅ order_items diperbaiki (InnoDB, ${r[0].c} baris). Silakan buat pesanan baru untuk mengisinya.`);
  await db.end();
  process.exit(0);
} catch (err) {
  console.error("❌ Perbaikan gagal:", err.code ?? "", err.message);
  await db.end().catch(() => {});
  process.exit(1);
}
