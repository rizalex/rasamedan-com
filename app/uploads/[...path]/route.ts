import { dbErrorMessage } from "@/lib/db";
import {
  SERVABLE_IMAGE_TYPES,
  edgeCache,
  objectKeyFromSegments,
  runAfterResponse,
  uploadsBucket,
} from "@/lib/uploads";

export const dynamic = "force-dynamic";

/** Nama file unik per upload (epoch + acak), jadi aman di-cache selamanya. */
const CACHE_CONTROL = "public, max-age=31536000, immutable";

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** If-None-Match bisa berisi daftar ETag dan/atau ETag lemah (W/"..."). */
function etagMatches(req: Request, etag: string | null): boolean {
  if (!etag) return false;
  const strip = (tag: string) => tag.trim().replace(/^W\//, "");
  const wanted = (req.headers.get("if-none-match") ?? "").split(",").map(strip);
  return wanted.includes("*") || wanted.includes(strip(etag));
}

/** 304 dengan header yang sama dengan respons 200 (tanpa body/Content-Length). */
function notModified(headers: Headers): Response {
  const h = new Headers(headers);
  h.delete("Content-Length");
  return new Response(null, { status: 304, headers: h });
}

/**
 * GET /uploads/<nama> — sajikan foto produk dari R2 (Skill 27). Path URL sama
 * dengan era disk `public/uploads`, jadi data `products.image` lama tetap valid.
 * Hanya tipe gambar raster yang disajikan inline; objek bertipe lain (mis.
 * diunggah manual) diunduh sebagai lampiran agar tidak bisa dieksekusi browser.
 *
 * Respons 200 disimpan di cache edge (backlog Skill 27): kunci cache = path saja
 * (query string diabaikan, sehingga `?x=acak` tidak bisa memaksa baca R2).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const key = objectKeyFromSegments(path);
  if (!key) return notFound();

  // Kunci dari kunci objek tervalidasi (bukan pathname mentah): variasi encoding
  // URL untuk objek yang sama memakai satu entri cache.
  const url = new URL(req.url);
  const cacheKey = new Request(`${url.origin}/${key}`, { method: "GET" });
  const cache = edgeCache();

  try {
    const cached = cache ? await cache.match(cacheKey) : undefined;
    if (cached) {
      if (etagMatches(req, cached.headers.get("ETag"))) return notModified(cached.headers);
      return cached;
    }

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

    if (etagMatches(req, obj.httpEtag)) {
      // Body R2 tidak dipakai — batalkan stream agar tidak menggantung.
      void obj.body.cancel().catch(() => {});
      return notModified(headers);
    }
    headers.set("Content-Length", String(obj.size));
    const response = new Response(obj.body, { status: 200, headers });
    if (cache) runAfterResponse(cache.put(cacheKey, response.clone()));
    return response;
  } catch (err) {
    console.error("GET /uploads gagal:", dbErrorMessage(err));
    return new Response("Error", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
