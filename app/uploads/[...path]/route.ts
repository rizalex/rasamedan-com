import { dbErrorMessage } from "@/lib/db";
import { SERVABLE_IMAGE_TYPES, objectKeyFromSegments, uploadsBucket } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/** Nama file unik per upload (epoch + acak), jadi aman di-cache selamanya. */
const CACHE_CONTROL = "public, max-age=31536000, immutable";

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * GET /uploads/<nama> — sajikan foto produk dari R2 (Skill 27). Path URL sama
 * dengan era disk `public/uploads`, jadi data `products.image` lama tetap valid.
 * Hanya tipe gambar raster yang disajikan inline; objek bertipe lain (mis.
 * diunggah manual) diunduh sebagai lampiran agar tidak bisa dieksekusi browser.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const key = objectKeyFromSegments(path);
  if (!key) return notFound();

  try {
    const obj = await uploadsBucket().get(key);
    if (!obj) return notFound();

    const headers = new Headers({
      "Cache-Control": CACHE_CONTROL,
      ETag: obj.httpEtag,
      "X-Content-Type-Options": "nosniff",
    });
    const type = obj.httpMetadata?.contentType ?? "";
    if (SERVABLE_IMAGE_TYPES.has(type)) {
      headers.set("Content-Type", type);
    } else {
      headers.set("Content-Type", "application/octet-stream");
      headers.set("Content-Disposition", "attachment");
    }

    // If-None-Match bisa berisi daftar ETag dan/atau ETag lemah (W/"...").
    const strip = (tag: string) => tag.trim().replace(/^W\//, "");
    const wanted = (req.headers.get("if-none-match") ?? "").split(",").map(strip);
    if (wanted.includes("*") || wanted.includes(strip(obj.httpEtag))) {
      return new Response(null, { status: 304, headers });
    }
    headers.set("Content-Length", String(obj.size));
    return new Response(obj.body, { status: 200, headers });
  } catch (err) {
    console.error("GET /uploads gagal:", dbErrorMessage(err));
    return new Response("Error", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
