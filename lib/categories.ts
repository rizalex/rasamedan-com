import { query } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { slugify } from "@/lib/slug";

/** Kategori produk dinamis (Skill 14). `products.category` menyimpan `slug`. */

export type Category = { id: number; name: string; slug: string };
export type CategoryWithCount = Category & { product_count: number };

/** Fallback bila DB tidak tersedia (mis. saat build tanpa koneksi). */
const FALLBACK: Category[] = [
  { id: 1, name: "Kue", slug: "kue" },
  { id: 2, name: "Kering", slug: "kering" },
  { id: 3, name: "Sirup", slug: "sirup" },
];

interface CategoryRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
}

interface CategoryCountRow extends CategoryRow {
  product_count: number;
}

/** Semua kategori (urut sesuai urutan dibuat). Dipakai katalog, beranda, form. */
export async function getAllCategories(): Promise<Category[]> {
  try {
    const rows = await query<CategoryRow[]>(
      "SELECT id, name, slug FROM categories ORDER BY id ASC"
    );
    if (rows.length === 0) return FALLBACK;
    return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug }));
  } catch {
    return FALLBACK;
  }
}

/** Kategori + jumlah produk yang memakainya (untuk halaman admin & cek hapus). */
export async function getCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  const rows = await query<CategoryCountRow[]>(
    `SELECT c.id, c.name, c.slug, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category = c.slug
      GROUP BY c.id, c.name, c.slug
      ORDER BY c.id ASC`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    product_count: Number(r.product_count),
  }));
}

/** Validasi input kategori dari admin (nama wajib, slug diturunkan dari nama). */
export function validateCategoryInput(
  body: Record<string, unknown>
): { ok: true; name: string; slug: string } | { ok: false; error: string } {
  const name = String(body.name ?? "").trim();
  if (!name) return { ok: false, error: "Nama kategori wajib diisi" };
  const slug = String(body.slug ?? "").trim() || slugify(name);
  if (!slug) return { ok: false, error: "Nama kategori tidak valid" };
  return { ok: true, name, slug };
}
