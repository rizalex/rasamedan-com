import { dbErrorMessage, query, queryIn } from "@/lib/db";
import dummyProducts from "@/data/dummy-products.json";

export type StockStatus = "tersedia" | "terbatas" | "pre-order" | "tanya-stok";

/** Varian produk. Harga jual = product.price + price_delta (lihat lib/pricing.ts). */
export type ProductVariant = {
  name: string;
  /** Selisih harga terhadap harga produk (boleh negatif). */
  price_delta: number;
  /** Berat varian (gram); 0 = ikut berat produk. */
  weight_grams: number;
};

export type Product = {
  id: number;
  slug: string;
  name: string;
  category: string;
  price: number;
  weight_grams: number;
  stock_status: StockStatus;
  is_halal: boolean;
  is_featured: boolean;
  description: string | null;
  ingredients: string | null;
  image: string | null;
  variants: ProductVariant[];
};

interface ProductRow {
  id: number;
  slug: string;
  name: string;
  category: string;
  price: number;
  weight_grams: number;
  stock_status: StockStatus;
  is_halal: number;
  is_featured: number;
  description: string | null;
  ingredients: string | null;
  image: string | null;
}

interface VariantRow {
  product_id: number;
  name: string;
  price_delta: number;
  weight_grams: number;
}

const PRODUCT_COLUMNS = `id, slug, name, category, price, weight_grams, stock_status, is_halal,
       is_featured, description, ingredients, image`;

function rowToProduct(row: ProductRow, variants: ProductVariant[]): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    price: row.price,
    weight_grams: row.weight_grams,
    stock_status: row.stock_status,
    is_halal: Boolean(row.is_halal),
    is_featured: Boolean(row.is_featured),
    description: row.description,
    ingredients: row.ingredients,
    image: row.image,
    variants,
  };
}

/** Ambil varian untuk sekumpulan produk, dikelompokkan per product_id. */
async function loadVariants(productIds: number[]): Promise<Map<number, ProductVariant[]>> {
  const byProduct = new Map<number, ProductVariant[]>();
  if (productIds.length === 0) return byProduct;
  const rows = await queryIn<VariantRow>(
    (ph) => `SELECT product_id, name, price_delta, weight_grams
       FROM product_variants
      WHERE product_id IN (${ph})
      ORDER BY product_id ASC, position ASC, id ASC`,
    productIds
  );
  for (const r of rows) {
    const list = byProduct.get(r.product_id) ?? [];
    list.push({
      name: r.name,
      price_delta: Number(r.price_delta) || 0,
      weight_grams: Number(r.weight_grams) || 0,
    });
    byProduct.set(r.product_id, list);
  }
  return byProduct;
}

async function withVariants(rows: ProductRow[]): Promise<Product[]> {
  const variants = await loadVariants(rows.map((r) => r.id));
  return rows.map((r) => rowToProduct(r, variants.get(r.id) ?? []));
}

/** Normalisasi varian dummy: menerima format objek maupun string lama. */
function normalizeDummyVariants(raw: unknown): ProductVariant[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) =>
    typeof v === "string"
      ? { name: v, price_delta: 0, weight_grams: 0 }
      : {
          name: String((v as ProductVariant).name),
          price_delta: Number((v as ProductVariant).price_delta) || 0,
          weight_grams: Number((v as ProductVariant).weight_grams) || 0,
        }
  );
}

/**
 * Fallback data/dummy-products.json bila DB tidak tersedia — KHUSUS development
 * (keputusan Skill 20.4). Di production, kegagalan DB dilempar ke halaman error
 * agar tidak diam-diam menampilkan katalog palsu (yang lalu gagal saat checkout).
 * Di-`import` statis, bukan dibaca via `node:fs` (Workers tidak punya filesystem).
 */
function readDummy(reason: unknown): Product[] {
  console.error("[products] DB tidak tersedia:", dbErrorMessage(reason));
  if (process.env.NODE_ENV === "production") {
    throw new Error("Database produk tidak tersedia");
  }
  console.warn("[products] Memakai data dummy (development saja).");
  const items = dummyProducts as Array<Record<string, unknown>>;
  return items.map((p) => ({
    id: Number(p.id),
    slug: String(p.slug),
    name: String(p.name),
    category: String(p.category),
    price: Number(p.price),
    weight_grams: Number(p.weight_grams ?? 0),
    stock_status: p.stock_status as StockStatus,
    is_halal: Boolean(p.is_halal),
    is_featured: Boolean(p.is_featured),
    description: (p.description as string) ?? null,
    ingredients: (p.ingredients as string) ?? null,
    image: (p.image as string) ?? null,
    variants: normalizeDummyVariants(p.variants),
  }));
}

/**
 * Ambil satu produk berdasarkan slug, lengkap dengan daftar variasinya.
 * Mengembalikan null bila tidak ditemukan.
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    const rows = await query<ProductRow>(
      `SELECT ${PRODUCT_COLUMNS} FROM products WHERE slug = ? LIMIT 1`,
      [slug]
    );
    if (rows.length === 0) return null;
    return (await withVariants(rows))[0];
  } catch (err) {
    const all = readDummy(err);
    return all.find((p) => p.slug === slug) ?? null;
  }
}

/** Ambil satu produk berdasarkan id (untuk form edit admin). */
export async function getProductById(id: number): Promise<Product | null> {
  const rows = await query<ProductRow>(
    `SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = ? LIMIT 1`,
    [id]
  );
  if (rows.length === 0) return null;
  return (await withVariants(rows))[0];
}

/**
 * Semua produk untuk katalog. Filter kategori & search dilakukan client-side
 * (dataset kecil, cukup cepat untuk MVP — lihat SKILLS.md Skill 4).
 */
export async function getAllProducts(): Promise<Product[]> {
  try {
    const rows = await query<ProductRow>(
      `SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY category ASC, name ASC`
    );
    return await withVariants(rows);
  } catch (err) {
    return readDummy(err);
  }
}

/**
 * Produk pilihan untuk beranda: hanya yang ditandai `is_featured` oleh admin.
 * Bila belum ada yang ditandai, tampilkan produk terbaru agar beranda tidak kosong.
 */
export async function getFeaturedProducts(limit = 6): Promise<Product[]> {
  const safeLimit = Math.max(1, Math.floor(limit));
  try {
    let rows = await query<ProductRow>(
      `SELECT ${PRODUCT_COLUMNS} FROM products
        WHERE is_featured = 1
        ORDER BY id DESC
        LIMIT ?`,
      [safeLimit]
    );
    if (rows.length === 0) {
      rows = await query<ProductRow>(
        `SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY id DESC LIMIT ?`,
        [safeLimit]
      );
    }
    return await withVariants(rows);
  } catch (err) {
    const all = readDummy(err);
    const featured = all.filter((p) => p.is_featured);
    return (featured.length > 0 ? featured : all).slice(0, safeLimit);
  }
}
