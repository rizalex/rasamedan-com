import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface CategoryRow extends RowDataPacket {
  id: number;
  slug: string;
}

/**
 * PUT /api/admin/categories/[id] — ubah NAMA kategori saja.
 * Slug sengaja tidak diubah agar produk lama yang menyimpan slug tidak "yatim".
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 401 });
  }
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Nama kategori wajib diisi" }, { status: 400 });
  }

  try {
    const [res] = await pool.execute<ResultSetHeader>(
      "UPDATE categories SET name = ? WHERE id = ?",
      [name, categoryId]
    );
    if (res.affectedRows === 0) {
      return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: categoryId, name });
  } catch (err) {
    console.error("PUT /api/admin/categories gagal:", err);
    return NextResponse.json({ error: "Gagal memperbarui kategori" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/categories/[id] — hapus kategori.
 * Ditolak bila masih ada produk yang memakainya (validasi AC2).
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 401 });
  }
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
  }

  try {
    const [rows] = await pool.query<CategoryRow[]>(
      "SELECT id, slug FROM categories WHERE id = ? LIMIT 1",
      [categoryId]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });
    }
    const slug = rows[0].slug;

    const [used] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM products WHERE category = ?",
      [slug]
    );
    const count = Number((used[0] as { n: number }).n);
    if (count > 0) {
      return NextResponse.json(
        {
          error: `Tidak bisa dihapus: masih ada ${count} produk memakai kategori ini. Pindahkan produk ke kategori lain dulu.`,
        },
        { status: 409 }
      );
    }

    await pool.execute("DELETE FROM categories WHERE id = ?", [categoryId]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/categories gagal:", err);
    return NextResponse.json({ error: "Gagal menghapus kategori" }, { status: 500 });
  }
}
