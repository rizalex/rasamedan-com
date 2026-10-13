import type { PoolConnection } from "mysql2/promise";
import { slugify } from "@/lib/slug";
import type { ProductVariant } from "@/lib/products";

/** Validasi & helper CRUD produk (server-only, dipakai route admin). */

const STOCK = ["tersedia", "terbatas", "pre-order", "tanya-stok"];
const MAX_VARIANTS = 20;
const MAX_PRICE_DELTA = 100_000_000;
const MAX_VARIANT_WEIGHT = 100_000;

export type ProductInput = {
  name: string;
  slug: string;
  category: string;
  price: number;
  weight_grams: number;
  stock_status: string;
  is_halal: boolean;
  is_featured: boolean;
  description: string | null;
  ingredients: string | null;
  image: string | null;
  variants: ProductVariant[];
};

type VariantResult = { ok: true; value: ProductVariant[] } | { ok: false; error: string };

/**
 * Validasi daftar varian terstruktur `[{ name, price_delta, weight_grams }]`.
 * Format lama (array string) sengaja DITOLAK, bukan dikonversi: konversi diam-diam
 * akan menghapus selisih harga & berat yang sudah tersimpan saat edit.
 */
function validateVariants(raw: unknown, price: number): VariantResult {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "Format varian tidak valid" };
  if (raw.length > MAX_VARIANTS) {
    return { ok: false, error: `Maksimal ${MAX_VARIANTS} varian per produk` };
  }
  const seen = new Set<string>();
  const out: ProductVariant[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      return { ok: false, error: "Format varian tidak valid (perbarui halaman admin)" };
    }
    const v = item as Record<string, unknown>;
    const name = String(v.name ?? "").trim();
    if (!name) return { ok: false, error: "Nama varian wajib diisi" };
    if (name.length > 100) return { ok: false, error: `Nama varian "${name.slice(0, 20)}…" terlalu panjang` };
    // Banding tanpa beda huruf besar/kecil: checkout mencocokkan varian per nama,
    // dan collation MySQL tidak peka huruf sementara SQLite (D1) peka.
    const key = name.toLowerCase();
    if (seen.has(key)) return { ok: false, error: `Nama varian "${name}" duplikat` };
    seen.add(key);

    const deltaRaw = v.price_delta ?? 0;
    const price_delta = deltaRaw === "" ? 0 : Number(deltaRaw);
    if (!Number.isInteger(price_delta) || Math.abs(price_delta) > MAX_PRICE_DELTA) {
      return { ok: false, error: `Selisih harga varian "${name}" harus bilangan bulat` };
    }
    if (price + price_delta < 0) {
      return { ok: false, error: `Harga varian "${name}" menjadi negatif` };
    }

    const weightRaw = v.weight_grams ?? 0;
    const weight_grams = weightRaw === "" ? 0 : Number(weightRaw);
    if (!Number.isInteger(weight_grams) || weight_grams < 0 || weight_grams > MAX_VARIANT_WEIGHT) {
      return { ok: false, error: `Berat varian "${name}" tidak valid (0 = ikut berat produk)` };
    }
    out.push({ name, price_delta, weight_grams });
  }
  return { ok: true, value: out };
}

export function validateProductInput(
  body: Record<string, unknown>
): { ok: true; value: ProductInput } | { ok: false; error: string } {
  const name = String(body.name ?? "").trim();
  const category = String(body.category ?? "").trim();
  const price = Math.floor(Number(body.price));
  const weight_grams = Math.floor(Number(body.weight_grams));
  const stock_status = String(body.stock_status ?? "").trim();
  if (!name) return { ok: false, error: "Nama produk wajib diisi" };
  if (name.length > 191) return { ok: false, error: "Nama produk maksimal 191 karakter" };
  if (!category) return { ok: false, error: "Kategori wajib diisi" };
  if (!Number.isFinite(price) || price < 0)
    return { ok: false, error: "Harga tidak valid" };
  if (!Number.isFinite(weight_grams) || weight_grams <= 0)
    return { ok: false, error: "Berat produk wajib diisi (gram, lebih dari 0)" };
  if (!STOCK.includes(stock_status))
    return { ok: false, error: "Status stok tidak valid" };

  if (!slugify(String(body.slug ?? "").trim() || name)) {
    return { ok: false, error: "Slug produk tidak valid (gunakan huruf/angka)" };
  }

  const variants = validateVariants(body.variants, price);
  if (!variants.ok) return variants;

  return {
    ok: true,
    value: {
      name,
      // Slug selalu dinormalisasi (juga bila diisi manual) agar URL produk valid.
      slug: slugify(String(body.slug ?? "").trim() || name).slice(0, 191),
      category,
      price,
      weight_grams,
      stock_status,
      is_halal: Boolean(body.is_halal),
      is_featured: Boolean(body.is_featured),
      description: body.description ? String(body.description) : null,
      ingredients: body.ingredients ? String(body.ingredients) : null,
      image: body.image ? String(body.image) : null,
      variants: variants.value,
    },
  };
}

/** Ganti seluruh varian produk (dipanggil di dalam transaksi yang sama dengan produk). */
export async function replaceVariants(
  conn: PoolConnection,
  productId: number,
  variants: ProductVariant[]
) {
  await conn.execute("DELETE FROM product_variants WHERE product_id = ?", [
    productId,
  ]);
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    await conn.execute(
      `INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position)
       VALUES (?, ?, ?, ?, ?)`,
      [productId, v.name, v.price_delta, v.weight_grams, i]
    );
  }
}
