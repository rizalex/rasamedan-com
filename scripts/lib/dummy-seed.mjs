/**
 * Pembangun SQL data dummy dari data/dummy-products.json (Skill 25) — dipakai
 * `npm run seed` dan `npm run seed:sql` (file db/seed/dummy-products.sql).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sqlValue } from "./d1.mjs";

const here = dirname(fileURLToPath(import.meta.url));

export function readDummyProducts() {
  return JSON.parse(readFileSync(join(here, "..", "..", "data", "dummy-products.json"), "utf8"));
}

/** Varian: format objek, format string lama tetap diterima (selisih 0, berat ikut produk). */
function normalizeVariants(raw) {
  return (Array.isArray(raw) ? raw : []).map((v) =>
    typeof v === "string"
      ? { name: v, price_delta: 0, weight_grams: 0 }
      : { name: v.name, price_delta: v.price_delta ?? 0, weight_grams: v.weight_grams ?? 0 }
  );
}

/**
 * Statement INSERT produk + varian dummy (id eksplisit dari JSON).
 * @returns {{ lines: string[], variantCount: number }}
 */
export function dummyInsertLines(products) {
  const lines = [];
  let variantCount = 0;
  for (const p of products) {
    const row = [
      p.id, p.slug, p.name, p.category, p.price, p.weight_grams ?? 0, p.stock_status,
      p.is_halal ? 1 : 0, p.is_featured ? 1 : 0, p.description ?? null, p.ingredients ?? null,
      p.image ?? null,
    ];
    lines.push(
      `INSERT INTO products (id, slug, name, category, price, weight_grams, stock_status, is_halal, is_featured, description, ingredients, image) VALUES (${row.map(sqlValue).join(", ")});`
    );
    normalizeVariants(p.variants).forEach((v, i) => {
      const vrow = [p.id, v.name, v.price_delta, v.weight_grams, i];
      lines.push(
        `INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (${vrow.map(sqlValue).join(", ")});`
      );
      variantCount++;
    });
  }
  return { lines, variantCount };
}

/**
 * Hapus produk dummy berdasarkan SLUG sebelum diisi ulang, sehingga file bisa
 * dijalankan berulang tanpa error. Varian ikut terhapus (CASCADE); item pesanan
 * lama → product_id NULL.
 * PERINGATAN: INSERT memakai id eksplisit dari JSON (1–9). Di D1 yang berisi
 * produk ASLI dengan id itu (mis. hasil impor production), INSERT gagal karena
 * id bentrok — sengaja tidak dihapus berdasarkan id agar produk asli aman.
 */
export function dummyDeleteLines(products) {
  const slugs = products.map((p) => sqlValue(p.slug)).join(", ");
  return [`DELETE FROM products WHERE slug IN (${slugs});`];
}

/** Tabel penanda D1 lokal — dibuat `npm run db:migrate` (lokal), tidak pernah di production. */
export const LOCAL_MARKER = "_local_dev";

/**
 * Penjaga di AWAL file seed SQL: gagal (CHECK) bila
 * - D1 tidak bertanda lokal (`_local_dev` tidak ada) — mis. D1 production,
 *   termasuk yang masih kosong sebelum impor data asli; atau
 * - D1 berisi produk selain produk dummy (mis. D1 lokal hasil impor data asli).
 * Statement gagal → wrangler berhenti sebelum DELETE/INSERT apa pun.
 */
export function dummyGuardLines(products) {
  const slugs = products.map((p) => sqlValue(p.slug)).join(", ");
  return [
    "DROP TABLE IF EXISTS _seed_guard;",
    "CREATE TABLE _seed_guard (violations INTEGER CHECK (violations = 0));",
    `INSERT INTO _seed_guard SELECT
       (SELECT COUNT(*) FROM products WHERE slug NOT IN (${slugs}))
     + (1 - (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '${LOCAL_MARKER}'));`,
    "DROP TABLE _seed_guard;",
  ];
}
