import { getCloudflareContext } from "@opennextjs/cloudflare";

export { objectKeyFromSegments } from "@/lib/upload-path.mjs";

/**
 * Penyimpanan foto produk di Cloudflare R2 (Skill 27), binding `UPLOADS`.
 *
 * URL publik tetap `/uploads/<nama>` (sama seperti era disk `public/uploads`),
 * sehingga kolom `products.image` tidak perlu dimigrasi. Kunci objek R2 =
 * `uploads/<nama>`; disajikan oleh app/uploads/[...path]/route.ts.
 *
 * Lokal (`next dev` / preview) memakai R2 tiruan miniflare di .wrangler/state.
 */

/** Tipe yang boleh disajikan sebagai gambar (SVG sengaja tidak: bisa berisi skrip). */
export const SERVABLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function uploadsBucket(): R2Bucket {
  const bucket = getCloudflareContext().env.UPLOADS;
  if (!bucket) {
    throw new Error("Binding R2 `UPLOADS` tidak tersedia (cek r2_buckets di wrangler.jsonc)");
  }
  return bucket;
}

/**
 * Cache edge Cloudflare (`caches.default`) untuk respons foto — menghemat
 * operasi baca R2 (Class B) untuk gambar yang sering dilihat. null bila tidak
 * tersedia (`next dev` di Node). Catatan: di subdomain *.workers.dev Cache API
 * tidak menyimpan apa pun (no-op); efektif setelah custom domain aktif (Skill 30).
 */
export function edgeCache(): Cache | null {
  const storage = (globalThis as { caches?: { default?: Cache } }).caches;
  return storage?.default ?? null;
}

/** Jalankan promise setelah respons terkirim (Workers), tanpa menahan respons. */
export function runAfterResponse(promise: Promise<unknown>): void {
  try {
    getCloudflareContext().ctx.waitUntil(promise);
  } catch {
    void promise.catch(() => {});
  }
}

/** Nama file baru dari server: `<epoch-ms>-<12 hex acak>.<ext>`. */
export function newUploadName(ext: string): string {
  const rand = crypto.getRandomValues(new Uint8Array(6));
  const hex = Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${Date.now()}-${hex}.${ext}`;
}
