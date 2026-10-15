/**
 * Aturan path foto `/uploads/...` (Skill 27) — SATU sumber untuk:
 * - route penyaji app/uploads/[...path] (via lib/uploads.ts),
 * - validasi field `image` produk (lib/product-admin.ts),
 * - skrip scripts/upload-to-r2.mjs.
 * JS murni tanpa dependensi agar bisa diimpor dari kode server, client, dan Node.
 */

/** Satu segmen aman: huruf/angka/titik/strip/garis bawah, tidak diawali titik. */
export const UPLOAD_SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/;
export const MAX_UPLOAD_SEGMENTS = 5;

/**
 * Segmen path (`/uploads/a/b.jpg` → ["a", "b.jpg"]) → kunci objek R2
 * `uploads/a/b.jpg`, atau null bila tidak valid (traversal, dotfile, terlalu dalam).
 * @param {string[]} segments
 * @returns {string | null}
 */
export function objectKeyFromSegments(segments) {
  if (segments.length === 0 || segments.length > MAX_UPLOAD_SEGMENTS) return null;
  if (!segments.every((s) => UPLOAD_SEGMENT.test(s))) return null;
  return `uploads/${segments.join("/")}`;
}

/**
 * URL `/uploads/...` yang bisa disajikan route penyaji.
 * @param {string} url
 */
export function isServableUploadUrl(url) {
  if (!url.startsWith("/uploads/")) return false;
  return objectKeyFromSegments(url.slice("/uploads/".length).split("/")) !== null;
}
