import { NextResponse } from "next/server";
import type { PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { validateProductInput, replaceVariants } from "@/lib/product-admin";

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

    // Pastikan slug unik.
    const [dup] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM products WHERE slug = ? LIMIT 1",
      [p.slug]
    );
    if (dup.length > 0) {
      return NextResponse.json(
        { error: `Slug "${p.slug}" sudah dipakai. Ganti nama atau slug.` },
        { status: 400 }
      );
    }

    await conn.beginTransaction();
    const [res] = await conn.execute<ResultSetHeader>(
      `INSERT INTO products
         (slug, name, category, price, weight_grams, stock_status, is_halal, description, ingredients, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ]
    );
    await replaceVariants(conn, res.insertId, p.variants);
    await conn.commit();

    return NextResponse.json({ ok: true, id: res.insertId, slug: p.slug });
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
    }
    console.error("POST /api/admin/products gagal:", err);
    return NextResponse.json({ error: "Gagal menyimpan produk" }, { status: 500 });
  } finally {
    if (conn) conn.release();
  }
}
