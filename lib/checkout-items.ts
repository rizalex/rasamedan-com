import { placeholders, query } from "@/lib/db";
import type { CheckoutItem } from "@/lib/orders";

/**
 * Validasi baris keranjang dari klien + harga & berat dari DB (server-only).
 * Dipakai POST /api/orders dan POST /api/shipping/rates (Skill 31) agar
 * keduanya memakai rumus yang sama (harga = produk + selisih varian; berat
 * varian bila > 0, selain itu berat produk — sama dengan lib/pricing.ts).
 * Harga/berat dari klien tidak pernah dipercaya.
 */

export const MAX_CART_LINES = 50;

export type ParsedItem = { productId: number; variant: string | null; quantity: number };

export type ItemErrorCode = "PRODUCT_NOT_FOUND" | "VARIANT_INVALID" | "VARIANT_REQUIRED";

interface ProductRow {
  id: number;
  name: string;
  price: number;
  weight_grams: number;
}

interface VariantRow {
  product_id: number;
  name: string;
  price_delta: number;
  weight_grams: number;
}

/**
 * Bentuk & batas baris mentah. Baris tidak valid DITOLAK, bukan dibuang diam-diam
 * (agar item pelanggan tidak hilang dari pesanan tanpa pemberitahuan).
 */
export function parseIncomingItems(raw: unknown): { ok: true; items: ParsedItem[] } | { ok: false; error: string } {
  const rows = Array.isArray(raw) ? raw : [];
  if (rows.length === 0) return { ok: false, error: "Keranjang kosong" };
  if (rows.length > MAX_CART_LINES) {
    return { ok: false, error: `Maksimal ${MAX_CART_LINES} baris item per pesanan` };
  }
  const items = rows.map((it: { productId?: unknown; variant?: unknown; quantity?: unknown }) => ({
    productId: Number(it?.productId),
    variant: it?.variant ? String(it.variant).slice(0, 100) : null,
    quantity: Number(it?.quantity),
  }));
  if (items.some((it) => !Number.isInteger(it.productId))) {
    return { ok: false, error: "Ada item yang tidak valid" };
  }
  if (items.some((it) => !Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 99)) {
    return { ok: false, error: "Jumlah per item harus 1–99" };
  }
  return { ok: true, items };
}

/** Ambil nama, harga, dan berat setiap baris dari DB (2 query, berapa pun jumlah baris). */
export async function resolveCheckoutItems(
  items: ParsedItem[]
): Promise<
  | { ok: true; items: CheckoutItem[] }
  | { ok: false; code: ItemErrorCode; error: string; productId: number; variant: string | null }
> {
  // Maks 50 id unik (MAX_CART_LINES) — di bawah batas 100 parameter D1.
  const ids = [...new Set(items.map((it) => it.productId))];
  const idPlaceholders = placeholders(ids.length);
  const productRows = await query<ProductRow>(
    `SELECT id, name, price, weight_grams FROM products WHERE id IN (${idPlaceholders})`,
    ids
  );
  const byId = new Map(productRows.map((p) => [p.id, p]));

  // Varian per produk: selisih harga & berat (override). Dicocokkan per nama.
  const variantRows = await query<VariantRow>(
    `SELECT product_id, name, price_delta, weight_grams FROM product_variants
      WHERE product_id IN (${idPlaceholders})`,
    ids
  );
  const variantsByProduct = new Map<number, Map<string, VariantRow>>();
  for (const v of variantRows) {
    if (!variantsByProduct.has(v.product_id)) variantsByProduct.set(v.product_id, new Map());
    variantsByProduct.get(v.product_id)!.set(v.name, v);
  }

  const out: CheckoutItem[] = [];
  for (const it of items) {
    const p = byId.get(it.productId);
    if (!p) {
      return {
        ok: false,
        code: "PRODUCT_NOT_FOUND",
        error: `Produk (id ${it.productId}) tidak ditemukan`,
        productId: it.productId,
        variant: it.variant,
      };
    }
    // Produk tanpa varian: tolak nama varian apa pun. Produk bervarian: varian
    // WAJIB dipilih dan terdaftar — bila tidak, klien bisa membayar harga dasar
    // untuk varian yang lebih mahal.
    const known = variantsByProduct.get(p.id);
    if (known && !it.variant) {
      return {
        ok: false,
        code: "VARIANT_REQUIRED",
        error: `Pilih varian untuk produk "${p.name}"`,
        productId: p.id,
        variant: null,
      };
    }
    const v = it.variant ? known?.get(it.variant) : undefined;
    if (it.variant && !v) {
      return {
        ok: false,
        code: "VARIANT_INVALID",
        error: `Varian "${it.variant}" untuk produk "${p.name}" sudah tidak tersedia`,
        productId: p.id,
        variant: it.variant,
      };
    }
    const unitPrice = p.price + (v ? Number(v.price_delta) : 0);
    if (unitPrice < 0) throw new Error(`Harga varian negatif untuk produk ${p.id}`);
    const vWeight = v ? Number(v.weight_grams) : 0;
    out.push({
      productId: p.id,
      name: p.name,
      variant: v ? v.name : null,
      quantity: it.quantity,
      unit_price: unitPrice,
      weight_grams: vWeight > 0 ? vWeight : Number(p.weight_grams),
    });
  }
  return { ok: true, items: out };
}

/** Total berat (gram); null bila ada baris tanpa berat (data lama berberat 0). */
export function totalWeightGrams(items: CheckoutItem[]): number | null {
  if (items.some((it) => !(it.weight_grams > 0))) return null;
  return items.reduce((sum, it) => sum + it.weight_grams * it.quantity, 0);
}
