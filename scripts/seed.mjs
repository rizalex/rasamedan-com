/**
 * Seed data dummy produk ke MySQL (Skill 2).
 * Sumber data: `data/dummy-products.json` (9 produk, 3 per kategori).
 * Jalankan:  npm run seed
 *
 * Idempotent: menghapus isi products + product_variants lalu memasukkan ulang,
 * sehingga aman dijalankan berkali-kali tanpa duplikat.
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
  await conn.beginTransaction();

  // Reset isi tabel produk & variasi (FK checks dimatikan sementara).
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");
  await conn.query("DELETE FROM product_variants");
  await conn.query("DELETE FROM products");
  await conn.query("ALTER TABLE products AUTO_INCREMENT = 1");
  await conn.query("ALTER TABLE product_variants AUTO_INCREMENT = 1");
  await conn.query("SET FOREIGN_KEY_CHECKS = 1");

  let variantCount = 0;
  for (const p of products) {
    await conn.execute(
      `INSERT INTO products
         (id, slug, name, category, price, weight_grams, stock_status, is_halal, description, ingredients, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id,
        p.slug,
        p.name,
        p.category,
        p.price,
        p.weight_grams ?? 0,
        p.stock_status,
        p.is_halal ? 1 : 0,
        p.description ?? null,
        p.ingredients ?? null,
        p.image ?? null,
      ]
    );

    const variants = Array.isArray(p.variants) ? p.variants : [];
    const variantWeights = p.variant_weights ?? {};
    for (let i = 0; i < variants.length; i++) {
      // Berat varian: pakai override bila ada, selain itu 0 (fallback ke berat produk).
      const vWeight = variantWeights[variants[i]] ?? 0;
      await conn.execute(
        `INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position)
         VALUES (?, ?, 0, ?, ?)`,
        [p.id, variants[i], vWeight, i]
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
