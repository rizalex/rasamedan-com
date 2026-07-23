import type { PoolConnection } from "mysql2/promise";
import { slugify } from "@/lib/slug";

/** Validasi & helper CRUD produk (server-only, dipakai route admin). */

const STOCK = ["tersedia", "terbatas", "pre-order", "tanya-stok"];

export type ProductInput = {
  name: string;
  slug: string;
  category: string;
  price: number;
  weight_grams: number;
  stock_status: string;
  is_halal: boolean;
  description: string | null;
  ingredients: string | null;
  image: string | null;
  variants: string[];
};

export function validateProductInput(
  body: Record<string, unknown>
): { ok: true; value: ProductInput } | { ok: false; error: string } {
  const name = String(body.name ?? "").trim();
  const category = String(body.category ?? "").trim();
  const price = Math.floor(Number(body.price));
  const weight_grams = Math.floor(Number(body.weight_grams));
  const stock_status = String(body.stock_status ?? "").trim();
  if (!name) return { ok: false, error: "Nama produk wajib diisi" };
  if (!category) return { ok: false, error: "Kategori wajib diisi" };
  if (!Number.isFinite(price) || price < 0)
    return { ok: false, error: "Harga tidak valid" };
  if (!Number.isFinite(weight_grams) || weight_grams <= 0)
    return { ok: false, error: "Berat produk wajib diisi (gram, lebih dari 0)" };
  if (!STOCK.includes(stock_status))
    return { ok: false, error: "Status stok tidak valid" };

  const variants = Array.isArray(body.variants)
    ? (body.variants as unknown[])
        .map((v) => String(v).trim())
        .filter((v) => v.length > 0)
    : [];

  return {
    ok: true,
    value: {
      name,
      slug: String(body.slug ?? "").trim() || slugify(name),
      category,
      price,
      weight_grams,
      stock_status,
      is_halal: Boolean(body.is_halal),
      description: body.description ? String(body.description) : null,
      ingredients: body.ingredients ? String(body.ingredients) : null,
      image: body.image ? String(body.image) : null,
      variants,
    },
  };
}

export async function replaceVariants(
  conn: PoolConnection,
  productId: number,
  variants: string[]
) {
  await conn.execute("DELETE FROM product_variants WHERE product_id = ?", [
    productId,
  ]);
  for (let i = 0; i < variants.length; i++) {
    await conn.execute(
      "INSERT INTO product_variants (product_id, name, price_delta, position) VALUES (?, ?, 0, ?)",
      [productId, variants[i], i]
    );
  }
}
