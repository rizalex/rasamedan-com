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
 *
 * Alternatif tanpa Node (hanya mengganti produk dummy, aman diulang):
 *   npx wrangler d1 execute rasamedan --local --file db/seed/dummy-products.sql
 */
import { d1ExecSql, d1Query, targetFromArgs } from "./lib/d1.mjs";
import { dummyInsertLines, readDummyProducts } from "./lib/dummy-seed.mjs";

const target = targetFromArgs();

// Data dummy hanya untuk D1 lokal: di production bisa menimpa/mengotori
// katalog asli (dan impor file ke D1 remote tidak dijamin atomik).
if (target === "--remote") {
  console.error("❌ Seed data dummy tidak diizinkan ke D1 production (--remote).");
  process.exit(1);
}

try {
  const products = readDummyProducts();
  console.log(`→ Membaca ${products.length} produk dari data/dummy-products.json (${target})`);

  const [{ n: existing }] = d1Query("SELECT COUNT(*) AS n FROM products", target);
  if (existing > 0 && !process.argv.includes("--force")) {
    console.error(
      `❌ Tabel products sudah berisi ${existing} produk — seed dibatalkan agar data tidak terhapus.`
    );
    console.error("   Bila memang ingin mengganti dengan data dummy: npm run seed -- --force");
    process.exit(1);
  }

  const { lines, variantCount } = dummyInsertLines(products);
  const sql = ["DELETE FROM product_variants;", "DELETE FROM products;", ...lines].join("\n");
  d1ExecSql(sql + "\n", target);
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
