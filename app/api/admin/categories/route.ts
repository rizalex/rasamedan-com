import { NextResponse } from "next/server";
import { dbErrorMessage, execute, isUniqueViolation, query } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { validateCategoryInput } from "@/lib/categories";

export const dynamic = "force-dynamic";

/** POST /api/admin/categories — buat kategori baru. */
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

  const parsed = validateCategoryInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const dup = await query(
      "SELECT id FROM categories WHERE slug = ? LIMIT 1",
      [parsed.slug]
    );
    if (dup.length > 0) {
      return NextResponse.json(
        { error: `Kategori "${parsed.slug}" sudah ada.` },
        { status: 400 }
      );
    }
    const res = await execute("INSERT INTO categories (name, slug) VALUES (?, ?)", [
      parsed.name,
      parsed.slug,
    ]);
    return NextResponse.json({ ok: true, id: res.lastRowId, slug: parsed.slug });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { error: `Kategori "${parsed.slug}" sudah ada.` },
        { status: 400 }
      );
    }
    console.error("POST /api/admin/categories gagal:", dbErrorMessage(err));
    return NextResponse.json({ error: "Gagal menyimpan kategori" }, { status: 500 });
  }
}
