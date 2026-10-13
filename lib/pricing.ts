/**
 * Rumus harga & berat varian — SATU-SATUNYA sumber rumus (Skill 20.4).
 * Aman untuk klien: hanya mengimpor tipe, tidak menyentuh DB atau `node:*`.
 *
 * Harga jual varian = harga produk + price_delta.
 * Berat varian      = weight_grams varian bila > 0, selain itu berat produk.
 */
import type { Product } from "@/lib/products";

type Priced = Pick<Product, "price" | "weight_grams" | "variants">;

/**
 * Harga satuan untuk varian terpilih.
 * - Produk tanpa varian: harga produk (nama varian diabaikan bila null).
 * - Produk bervarian: harga varian; `null` bila varian kosong/tidak dikenal.
 */
export function variantPrice(product: Priced, variantName: string | null): number | null {
  if (product.variants.length === 0) return variantName ? null : product.price;
  const v = product.variants.find((x) => x.name === variantName);
  return v ? product.price + v.price_delta : null;
}

/** Berat satuan varian (fallback ke berat produk). */
export function variantWeight(product: Priced, variantName: string | null): number {
  const v = product.variants.find((x) => x.name === variantName);
  return v && v.weight_grams > 0 ? v.weight_grams : product.weight_grams;
}

/**
 * Rentang harga untuk ditampilkan ("Mulai dari ..."). Untuk produk bervarian,
 * harga dasar tanpa varian tidak dihitung karena varian wajib dipilih.
 */
export function priceRange(product: Priced): { min: number; max: number } {
  if (product.variants.length === 0) return { min: product.price, max: product.price };
  const prices = product.variants.map((v) => product.price + v.price_delta);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}
