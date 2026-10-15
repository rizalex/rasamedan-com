/**
 * Bangkitkan db/seed/dummy-products.sql dari data/dummy-products.json (Skill 25).
 * Jalankan setelah mengubah JSON:  npm run seed:sql
 *
 * File hasilnya bisa dijalankan ulang kapan saja (hanya mengganti produk dummy):
 *   npx wrangler d1 execute rasamedan --local --file db/seed/dummy-products.sql
 * Sengaja BUKAN file di migrations/: migrasi juga diterapkan ke D1 production,
 * sedangkan data dummy tidak boleh masuk production.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dummyDeleteLines, dummyGuardLines, dummyInsertLines, readDummyProducts } from "./lib/dummy-seed.mjs";

const OUT = "db/seed/dummy-products.sql";
const products = readDummyProducts();
const { lines, variantCount } = dummyInsertLines(products);
const header = [
  "-- DIBANGKITKAN OTOMATIS oleh scripts/build-seed-sql.mjs dari data/dummy-products.json.",
  "-- Jangan diedit manual — ubah JSON lalu jalankan: npm run seed:sql",
  "-- Hanya untuk D1 LOKAL (bertanda _local_dev dari npm run db:migrate). Penjaga _seed_guard",
  "-- membuat file ini GAGAL tanpa mengubah apa pun di D1 production (walau kosong) atau",
  "-- D1 berisi produk non-dummy (mis. hasil impor data asli). Aman dijalankan ulang:",
  "--   npx wrangler d1 execute rasamedan --local --file db/seed/dummy-products.sql",
];
mkdirSync("db/seed", { recursive: true });
writeFileSync(OUT, [...header, ...dummyGuardLines(products), ...dummyDeleteLines(products), ...lines].join("\n") + "\n");
console.log(`✅ ${OUT}: ${products.length} produk, ${variantCount} varian.`);
