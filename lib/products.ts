import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { query } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export type StockStatus = "tersedia" | "terbatas" | "pre-order" | "tanya-stok";

export type Product = {
  id: number;
  slug: string;
  name: string;
  category: string;
  price: number;
  weight_grams: number;
  stock_status: StockStatus;
  is_halal: boolean;
  description: string | null;
  ingredients: string | null;
  image: string | null;
  variants: string[];
};

interface ProductRow extends RowDataPacket {
  id: number;
  slug: string;
  name: string;
  category: string;
  price: number;
  weight_grams: number;
  stock_status: StockStatus;
  is_halal: number;
  description: string | null;
  ingredients: string | null;
  image: string | null;
}

function rowToProduct(row: ProductRow, variants: string[]): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    price: row.price,
    weight_grams: row.weight_grams,
    stock_status: row.stock_status,
    is_halal: Boolean(row.is_halal),
    description: row.description,
    ingredients: row.ingredients,
    image: row.image,
    variants,
  };
}

/**
 * Fallback: baca langsung dari data/dummy-products.json bila DB tidak tersedia
 * (mis. saat `next build` tanpa koneksi DB). Menjaga halaman tetap ter-render.
 */
async function readDummy(): Promise<Product[]> {
  const raw = await readFile(
    join(process.cwd(), "data", "dummy-products.json"),
    "utf8"
  );
  const items = JSON.parse(raw) as Array<Record<string, unknown>>;
  return items.map((p) => ({
    id: Number(p.id),
    slug: String(p.slug),
    name: String(p.name),
    category: String(p.category),
    price: Number(p.price),
    weight_grams: Number(p.weight_grams ?? 0),
    stock_status: p.stock_status as StockStatus,
    is_halal: Boolean(p.is_halal),
    description: (p.description as string) ?? null,
    ingredients: (p.ingredients as string) ?? null,
    image: (p.image as string) ?? null,
    variants: Array.isArray(p.variants) ? (p.variants as string[]) : [],
  }));
}

interface VariantRow extends RowDataPacket {
  name: string;
}

/**
 * Ambil satu produk berdasarkan slug, lengkap dengan daftar variasinya.
 * Mengembalikan null bila tidak ditemukan.
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    const rows = await query<ProductRow[]>(
      `SELECT id, slug, name, category, price, weight_grams, stock_status, is_halal,
              description, ingredients, image
         FROM products
        WHERE slug = ?
        LIMIT 1`,
      [slug]
    );
    if (rows.length === 0) return null;

    const variantRows = await query<VariantRow[]>(
      `SELECT name FROM product_variants WHERE product_id = ? ORDER BY position ASC, id ASC`,
      [rows[0].id]
    );
    return rowToProduct(
      rows[0],
      variantRows.map((v) => v.name)
    );
  } catch {
    const all = await readDummy();
    return all.find((p) => p.slug === slug) ?? null;
  }
}

/** Ambil satu produk berdasarkan id (untuk form edit admin). */
export async function getProductById(id: number): Promise<Product | null> {
  const rows = await query<ProductRow[]>(
    `SELECT id, slug, name, category, price, weight_grams, stock_status, is_halal,
            description, ingredients, image
       FROM products WHERE id = ? LIMIT 1`,
    [id]
  );
  if (rows.length === 0) return null;
  const variantRows = await query<VariantRow[]>(
    "SELECT name FROM product_variants WHERE product_id = ? ORDER BY position ASC, id ASC",
    [rows[0].id]
  );
  return rowToProduct(
    rows[0],
    variantRows.map((v) => v.name)
  );
}

/**
 * Semua produk untuk katalog. Filter kategori & search dilakukan client-side
 * (dataset kecil, cukup cepat untuk MVP — lihat SKILLS.md Skill 4).
 */
export async function getAllProducts(): Promise<Product[]> {
  try {
    const rows = await query<ProductRow[]>(
      `SELECT id, slug, name, category, price, weight_grams, stock_status, is_halal,
              description, ingredients, image
         FROM products
        ORDER BY category ASC, name ASC`
    );
    return rows.map((r) => rowToProduct(r, []));
  } catch {
    return readDummy();
  }
}

/**
 * Produk pilihan untuk beranda. Ambil yang ditandai `is_featured`, dilengkapi
 * produk terbaru bila kurang dari `limit`.
 */
export async function getFeaturedProducts(limit = 6): Promise<Product[]> {
  // LIMIT di-inline sebagai integer tersanitasi: mysql2 execute() bermasalah
  // dengan placeholder `?` pada LIMIT. `limit` internal (bukan input user).
  const safeLimit = Math.max(1, Math.floor(limit));
  try {
    const rows = await query<ProductRow[]>(
      `SELECT id, slug, name, category, price, weight_grams, stock_status, is_halal,
              description, ingredients, image
         FROM products
        ORDER BY is_featured DESC, id ASC
        LIMIT ${safeLimit}`
    );
    return rows.map((r) => rowToProduct(r, []));
  } catch {
    const all = await readDummy();
    return all.slice(0, limit);
  }
}
