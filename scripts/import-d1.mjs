/**
 * Impor file hasil `npm run db:export` ke D1 lalu verifikasi (Skill 25).
 *
 * Jalankan:  npm run db:import -- --file db-export/<file>.sql            (D1 lokal, uji)
 *            npm run db:import -- --file db-export/<file>.sql --remote   (D1 production)
 *
 * Pengaman:
 * - Menolak jalan bila products/product_variants/orders/order_items di D1
 *   tujuan sudah berisi (impor hanya untuk D1 baru hasil `db:migrate`).
 *   Kategori boleh sudah ada (di-upsert per slug).
 * - Sesudah impor: jumlah baris tiap tabel dicocokkan dengan manifest di
 *   kepala file, order_code dicek unik, FK dicek (PRAGMA foreign_key_check).
 *
 * Bila impor remote gagal di tengah (impor file D1 tidak dijamin atomik),
 * kosongkan tabel data lalu ulangi:
 *   npx wrangler d1 execute rasamedan --remote --command "DELETE FROM order_items; DELETE FROM orders; DELETE FROM product_variants; DELETE FROM products;"
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DB_NAME, d1ExecFile, d1Query, targetFromArgs } from "./lib/d1.mjs";

const args = process.argv.slice(2);
const fileIdx = args.indexOf("--file");
const fileArg = fileIdx >= 0 ? args[fileIdx + 1] : undefined;
if (!fileArg || fileArg.startsWith("--")) {
  console.error("❌ --file wajib, mis. npm run db:import -- --file db-export/rasamedan-xxxx.sql");
  process.exit(1);
}
const file = resolve(fileArg);
const target = targetFromArgs();

let sql;
try {
  sql = readFileSync(file, "utf8");
} catch {
  console.error(`❌ File tidak bisa dibaca: ${file}`);
  process.exit(1);
}
const m = sql.match(/^-- manifest: (\{.*\})$/m);
if (!m) {
  console.error("❌ Manifest tidak ditemukan — file harus hasil `npm run db:export`.");
  process.exit(1);
}
let manifest;
try {
  manifest = JSON.parse(m[1]);
} catch {
  console.error("❌ Manifest rusak — ekspor ulang dengan `npm run db:export`.");
  process.exit(1);
}
const DATA_TABLES = ["products", "product_variants", "orders", "order_items"];
const count = (table) => Number(d1Query(`SELECT COUNT(*) AS n FROM ${table}`, target)[0]?.n ?? 0);

try {
  console.log(`→ Impor ${file} ke D1 ${DB_NAME} (${target === "--remote" ? "REMOTE" : "lokal"})`);
  const nonEmpty = DATA_TABLES.filter((t) => count(t) > 0);
  if (nonEmpty.length > 0) {
    console.error(`❌ D1 tujuan sudah berisi data (${nonEmpty.join(", ")}) — impor dibatalkan.`);
    console.error("   Impor hanya untuk D1 baru. Lihat komentar di scripts/import-d1.mjs untuk mengosongkan.");
    process.exit(1);
  }
  const categoriesBefore = count("categories");

  d1ExecFile(file, target);

  let ok = true;
  const check = (label, actual, expected) => {
    const pass = actual === expected;
    ok &&= pass;
    console.log(`   ${pass ? "✓" : "✗"} ${label}: ${actual}${pass ? "" : ` (seharusnya ${expected})`}`);
  };
  for (const t of DATA_TABLES) check(t, count(t), manifest[t]);
  // Kategori di-upsert: minimal sebanyak sumber, ditambah kategori awal migrasi yang tidak ada di sumber.
  const categoriesAfter = count("categories");
  const catOk = categoriesAfter >= manifest.categories && categoriesAfter >= categoriesBefore;
  ok &&= catOk;
  console.log(`   ${catOk ? "✓" : "✗"} categories: ${categoriesAfter} (sumber ${manifest.categories})`);

  const dupes = d1Query(
    "SELECT COUNT(*) AS n FROM (SELECT order_code FROM orders GROUP BY order_code HAVING COUNT(*) > 1)",
    target
  )[0]?.n;
  check("order_code kembar", Number(dupes ?? 0), 0);
  const fk = d1Query("PRAGMA foreign_key_check", target);
  check("pelanggaran foreign key (PRAGMA)", fk.length, 0);
  // Cadangan eksplisit (tidak bergantung pada PRAGMA di D1 remote).
  const orphans = d1Query(
    `SELECT
       (SELECT COUNT(*) FROM product_variants v LEFT JOIN products p ON p.id = v.product_id WHERE p.id IS NULL)
     + (SELECT COUNT(*) FROM order_items i LEFT JOIN orders o ON o.id = i.order_id WHERE o.id IS NULL)
     + (SELECT COUNT(*) FROM order_items i LEFT JOIN products p ON p.id = i.product_id
         WHERE i.product_id IS NOT NULL AND p.id IS NULL) AS n`,
    target
  )[0]?.n;
  check("baris yatim (varian/item)", Number(orphans ?? 0), 0);

  if (!ok) {
    console.error("❌ Verifikasi GAGAL — periksa log di atas sebelum cutover.");
    process.exit(1);
  }
  console.log("✅ Impor terverifikasi. Langkah berikut: buat admin (npm run seed:admin -- --remote) bila belum.");
} catch (err) {
  console.error("❌ Impor gagal:", err?.message ?? err);
  process.exit(1);
}
