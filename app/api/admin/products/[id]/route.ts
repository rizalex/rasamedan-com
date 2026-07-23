import { NextResponse } from "next/server";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { validateProductInput, replaceVariants } from "@/lib/product-admin";

export const dynamic = "force-dynamic";

/** PUT /api/admin/products/[id] — perbarui produk. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 401 });
  }
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isFinite(productId)) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
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

  let conn: PoolConnection | null = null;
  try {
    conn = await pool.getConnection();

    // Kategori harus terdaftar (validasi terhadap tabel categories — Skill 14).
    const [catRows] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM categories WHERE slug = ? LIMIT 1",
      [p.category]
    );
    if (catRows.length === 0) {
      return NextResponse.json(
        { error: `Kategori "${p.category}" tidak terdaftar.` },
        { status: 400 }
      );
    }

    // Slug unik kecuali milik produk ini sendiri.
    const [dup] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM products WHERE slug = ? AND id <> ? LIMIT 1",
      [p.slug, productId]
    );
    if (dup.length > 0) {
      return NextResponse.json(
        { error: `Slug "${p.slug}" sudah dipakai produk lain.` },
        { status: 400 }
      );
    }

    await conn.beginTransaction();
    await conn.execute(
      `UPDATE products SET slug=?, name=?, category=?, price=?, weight_grams=?, stock_status=?,
              is_halal=?, description=?, ingredients=?, image=?
        WHERE id=?`,
      [
        p.slug,
        p.name,
        p.category,
        p.price,
        p.weight_grams,
        p.stock_status,
        p.is_halal ? 1 : 0,
        p.description,
        p.ingredients,
        p.image,
        productId,
      ]
    );
    await replaceVariants(conn, productId, p.variants);
    await conn.commit();
    return NextResponse.json({ ok: true, id: productId, slug: p.slug });
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
    }
    console.error("PUT /api/admin/products gagal:", err);
    return NextResponse.json({ error: "Gagal memperbarui produk" }, { status: 500 });
  } finally {
    if (conn) conn.release();
  }
}

/** DELETE /api/admin/products/[id] — hapus produk (variasi ikut terhapus via FK). */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 401 });
  }
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isFinite(productId)) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
  }
  try {
    await pool.execute("DELETE FROM products WHERE id = ?", [productId]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/products gagal:", err);
    return NextResponse.json({ error: "Gagal menghapus produk" }, { status: 500 });
  }
}
