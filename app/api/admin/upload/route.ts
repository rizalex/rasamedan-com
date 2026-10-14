import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db";
import { detectImageType } from "@/lib/image-type.mjs";
import { newUploadName, uploadsBucket } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * POST /api/admin/upload — unggah 1 foto produk ke R2 (Skill 27).
 * Tipe file ditentukan dari isi (magic bytes), bukan dari `file.type`/nama file
 * kiriman klien; ekstensi & nama file selalu dibuat server (Skill 21.2 no. 6).
 * Respons `url` = `/uploads/<nama>` (disajikan app/uploads/[...path]/route.ts).
 */
export async function POST(req: Request) {
  // Multipart adalah request "simple" CORS: form situs lain bisa mengirimnya.
  // Cookie sameSite=strict sudah menahannya, tetapi "same-site" mencakup
  // subdomain — tolak juga Origin lintas origin (anti-CSRF berlapis).
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Origin tidak diizinkan" }, { status: 403 });
  }

  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 401 });
  }

  // Tolak body raksasa sebelum dibaca ke memori (header bisa dipalsukan, jadi
  // ukuran tetap dicek ulang dari isi di bawah). +64 KB untuk overhead multipart.
  // Tanpa Content-Length (chunked) body tidak bisa dibatasi sebelum dibaca → 411.
  const declared = Number(req.headers.get("content-length") ?? NaN);
  if (!Number.isFinite(declared)) {
    return NextResponse.json({ error: "Content-Length wajib" }, { status: 411 });
  }
  if (declared > MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "Ukuran file maksimal 2 MB" }, { status: 400 });
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
    const filename = newUploadName(kind.ext);
    // Content-Type disimpan dari hasil deteksi server, bukan dari klien.
    await uploadsBucket().put(`uploads/${filename}`, bytes, {
      httpMetadata: { contentType: kind.mime },
    });
    return NextResponse.json({ ok: true, url: `/uploads/${filename}` });
  } catch (err) {
    console.error("POST /api/admin/upload gagal:", dbErrorMessage(err));
    return NextResponse.json({ error: "Gagal mengunggah file" }, { status: 500 });
  }
}
