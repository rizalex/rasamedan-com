import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getAdminSession } from "@/lib/auth";
import { detectImageType } from "@/lib/image-type";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * POST /api/admin/upload — unggah 1 foto produk ke /public/uploads.
 * Tipe file ditentukan dari isi (magic bytes), bukan dari `file.type`/nama file
 * kiriman klien; ekstensi & nama file selalu dibuat server (Skill 21.2 no. 6).
 * Penyimpanan disk lokal sementara — pindah ke R2 di Skill 27.
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Form tidak valid" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Ukuran file maksimal 2 MB" },
      { status: 400 }
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Cek ulang ukuran dari isi sebenarnya (file.size berasal dari klien).
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Ukuran file maksimal 2 MB" }, { status: 400 });
    }
    const kind = detectImageType(bytes);
    if (!kind) {
      return NextResponse.json(
        { error: "Tipe file harus gambar (JPG, PNG, WEBP, atau GIF)" },
        { status: 400 }
      );
    }
    const dir = join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const filename = `${Date.now()}-${randomBytes(6).toString("hex")}.${kind.ext}`;
    await writeFile(join(dir, filename), bytes);
    return NextResponse.json({ ok: true, url: `/uploads/${filename}` });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    console.error("POST /api/admin/upload gagal:", e.code ?? e.message ?? "unknown");
    return NextResponse.json({ error: "Gagal mengunggah file" }, { status: 500 });
  }
}
