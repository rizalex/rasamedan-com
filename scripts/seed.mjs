/**
 * Seed data dummy produk ke MySQL (Skill 2).
 * Sumber data: `data/dummy-products.json` (9 produk, 3 per kategori).
 * Jalankan:  npm run seed
 *
 * PENGAMAN: menolak jalan bila tabel products sudah berisi, agar katalog asli
 * di production tidak terhapus tak sengaja. Untuk mengisi ulang data dummy:
 *   npm run seed -- --force
 * Dengan --force, isi products + product_variants diganti dalam SATU transaksi
 * (gagal di tengah → dikembalikan utuh). FK tetap aktif: varian ikut terhapus
 * (CASCADE) dan order_items.product_id menjadi NULL (snapshot nama tetap ada).
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import mysql from "mysql2/promise";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, "..", "data", "dummy-products.json");

const config = {
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

let conn;
try {
  const products = JSON.parse(await readFile(dataPath, "utf8"));
  console.log(`→ Membaca ${products.length} produk dari data/dummy-products.json`);

  conn = await mysql.createConnection(config);

  const [[{ n: existing }]] = await conn.query("SELECT COUNT(*) AS n FROM products");
  if (existing > 0 && !process.argv.includes("--force")) {
    console.error(
      `❌ Tabel products sudah berisi ${existing} produk — seed dibatalkan agar data tidak terhapus.`
    );
    console.error("   Bila memang ingin mengganti dengan data dummy: npm run seed -- --force");
    await conn.end();
    process.exit(1);
  }

  // Tanpa DDL (ALTER TABLE) di dalam transaksi: DDL meng-commit implisit sehingga
  // rollback tidak bisa mengembalikan DELETE. Id eksplisit dari JSON dipakai,
  // jadi reset AUTO_INCREMENT tidak diperlukan.
  await conn.beginTransaction();
  await conn.query("DELETE FROM product_variants");
  await conn.query("DELETE FROM products");

  let variantCount = 0;
  for (const p of products) {
    await conn.execute(
      `INSERT INTO products
         (id, slug, name, category, price, weight_grams, stock_status, is_halal, is_featured,
          description, ingredients, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id,
        p.slug,
        p.name,
        p.category,
        p.price,
        p.weight_grams ?? 0,
        p.stock_status,
        p.is_halal ? 1 : 0,
        p.is_featured ? 1 : 0,
        p.description ?? null,
        p.ingredients ?? null,
        p.image ?? null,
      ]
    );

    // Varian: format objek { name, price_delta, weight_grams } (format string
    // lama tetap diterima: selisih 0, berat ikut produk). Sama dengan lib/products.ts.
    const variants = (Array.isArray(p.variants) ? p.variants : []).map((v) =>
      typeof v === "string"
        ? { name: v, price_delta: 0, weight_grams: 0 }
        : { name: v.name, price_delta: v.price_delta ?? 0, weight_grams: v.weight_grams ?? 0 }
    );
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      await conn.execute(
        `INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position)
         VALUES (?, ?, ?, ?, ?)`,
        [p.id, v.name, v.price_delta, v.weight_grams, i]
      );
      variantCount++;
    }
  }

  await conn.commit();
  console.log(
    `✅ Seed selesai: ${products.length} produk & ${variantCount} variasi dimasukkan.`
  );

  // Ringkasan per kategori (verifikasi acceptance criteria).
  const [byCat] = await conn.query(
    "SELECT category, COUNT(*) AS n FROM products GROUP BY category ORDER BY category"
  );
  console.log("   Produk per kategori:");
  for (const row of byCat) console.log(`     - ${row.category}: ${row.n}`);

  await conn.end();
  process.exit(0);
} catch (err) {
  if (conn) {
    try {
      await conn.rollback();
    } catch {}
    await conn.end();
  }
  console.error("❌ Seed gagal.");
  console.error("   ", err.code ?? "", err.message);
  console.error("   Pastikan schema sudah diterapkan (npm run db:schema) & `.env` benar.");
  process.exit(1);
}
