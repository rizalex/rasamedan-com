/**
 * Seed data dummy produk ke D1 (Skill 2, versi D1 Skill 24).
 * Sumber data: `data/dummy-products.json` (9 produk, 3 per kategori).
 * Kategori awal (kue/kering/sirup) sudah dibuat oleh migrations/0001_init.sql.
 *
 * Jalankan:  npm run seed      (HANYA D1 lokal; butuh `npm run db:migrate`)
 * `--remote` selalu ditolak: data dummy tidak pernah boleh masuk production
 * (bentrok id/slug dengan impor data asli Skill 25).
 *
 * PENGAMAN: menolak jalan bila tabel products sudah berisi, agar data lokal
 * tidak terhapus tak sengaja. Untuk mengisi ulang data dummy:
 *   npm run seed -- --force
 * Dengan --force, products + product_variants dikosongkan lalu diisi ulang.
 * FK tetap aktif: varian ikut terhapus (CASCADE) dan order_items.product_id
 * menjadi NULL (snapshot nama di pesanan tetap ada).
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { d1ExecSql, d1Query, sqlValue, targetFromArgs } from "./lib/d1.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, "..", "data", "dummy-products.json");
const target = targetFromArgs();

// Data dummy hanya untuk D1 lokal: di production bisa menimpa/mengotori
// katalog asli (dan impor file ke D1 remote tidak dijamin atomik).
if (target === "--remote") {
  console.error("❌ Seed data dummy tidak diizinkan ke D1 production (--remote).");
  process.exit(1);
}

try {
  const products = JSON.parse(await readFile(dataPath, "utf8"));
  console.log(`→ Membaca ${products.length} produk dari data/dummy-products.json (${target})`);

  const [{ n: existing }] = d1Query("SELECT COUNT(*) AS n FROM products", target);
  if (existing > 0 && !process.argv.includes("--force")) {
    console.error(
      `❌ Tabel products sudah berisi ${existing} produk — seed dibatalkan agar data tidak terhapus.`
    );
    console.error("   Bila memang ingin mengganti dengan data dummy: npm run seed -- --force");
    process.exit(1);
  }

  const lines = ["DELETE FROM product_variants;", "DELETE FROM products;"];
  let variantCount = 0;
  for (const p of products) {
    const row = [
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
    ];
    lines.push(
      `INSERT INTO products (id, slug, name, category, price, weight_grams, stock_status, is_halal, is_featured, description, ingredients, image) VALUES (${row.map(sqlValue).join(", ")});`
    );

    // Varian: format objek { name, price_delta, weight_grams } (format string
    // lama tetap diterima: selisih 0, berat ikut produk). Sama dengan lib/products.ts.
    const variants = (Array.isArray(p.variants) ? p.variants : []).map((v) =>
      typeof v === "string"
        ? { name: v, price_delta: 0, weight_grams: 0 }
        : { name: v.name, price_delta: v.price_delta ?? 0, weight_grams: v.weight_grams ?? 0 }
    );
    variants.forEach((v, i) => {
      const vrow = [p.id, v.name, v.price_delta, v.weight_grams, i];
      lines.push(
        `INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (${vrow.map(sqlValue).join(", ")});`
      );
      variantCount++;
    });
  }

  d1ExecSql(lines.join("\n") + "\n", target);
  console.log(`✅ Seed selesai: ${products.length} produk & ${variantCount} variasi dimasukkan.`);

  // Ringkasan per kategori (verifikasi acceptance criteria).
  const byCat = d1Query(
    "SELECT category, COUNT(*) AS n FROM products GROUP BY category ORDER BY category",
    target
  );
  console.log("   Produk per kategori:");
  for (const row of byCat) console.log(`     - ${row.category}: ${row.n}`);
} catch (err) {
  console.error("❌ Seed gagal.");
  console.error("   " + (err?.message ?? err));
  console.error("   Pastikan migrasi sudah diterapkan: npm run db:migrate");
  process.exit(1);
}
