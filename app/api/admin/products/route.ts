import { NextResponse } from "next/server";
import { batch, dbErrorMessage, isUniqueViolation, query, statement } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { validateProductInput, variantInsertStatements } from "@/lib/product-admin";

export const dynamic = "force-dynamic";

/** POST /api/admin/products — buat produk baru. */
export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const parsed = validateProductInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const p = parsed.value;
  const slugTaken = () =>
    NextResponse.json(
      { error: `Slug "${p.slug}" sudah dipakai. Ganti nama atau slug.` },
      { status: 400 }
    );

  try {
    // Kategori harus terdaftar (validasi terhadap tabel categories — Skill 14).
    const catRows = await query("SELECT id FROM categories WHERE slug = ? LIMIT 1", [p.category]);
    if (catRows.length === 0) {
      return NextResponse.json(
        { error: `Kategori "${p.category}" tidak terdaftar.` },
        { status: 400 }
      );
    }

    // Pastikan slug unik (UNIQUE di DB tetap menjaga bila ada request bersamaan).
    const dup = await query("SELECT id FROM products WHERE slug = ? LIMIT 1", [p.slug]);
    if (dup.length > 0) return slugTaken();

    // Produk + varian dalam satu batch (atomik). Varian merujuk produk lewat slug
    // karena id baru belum diketahui sebelum batch berjalan.
    const [res] = await batch([
      statement(
        `INSERT INTO products
           (slug, name, category, price, weight_grams, stock_status, is_halal, is_featured,
            description, ingredients, image)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.slug,
          p.name,
          p.category,
          p.price,
          p.weight_grams,
          p.stock_status,
          p.is_halal ? 1 : 0,
          p.is_featured ? 1 : 0,
          p.description,
          p.ingredients,
          p.image,
        ]
      ),
      ...variantInsertStatements({ slug: p.slug }, p.variants),
    ]);
    const id = res.meta.last_row_id;

    return NextResponse.json({ ok: true, id, slug: p.slug });
  } catch (err) {
    if (isUniqueViolation(err)) return slugTaken();
    console.error("POST /api/admin/products gagal:", dbErrorMessage(err));
    return NextResponse.json({ error: "Gagal menyimpan produk" }, { status: 500 });
  }
}
