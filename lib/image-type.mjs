/**
 * Deteksi tipe gambar dari isi file (magic bytes) — Skill 21.2 no. 6.
 * JANGAN percaya `file.type` atau ekstensi dari klien: keduanya bisa dipalsukan.
 * Portabel (hanya Uint8Array, JS murni): dipakai route upload R2 DAN skrip Node
 * scripts/upload-to-r2.mjs (Skill 27) — satu sumber aturan tipe file.
 */

/** @typedef {{ mime: string, ext: string }} ImageKind */

/**
 * @param {Uint8Array} bytes
 * @param {number[]} sig
 * @param {number} [offset]
 */
function startsWith(bytes, sig, offset = 0) {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

/**
 * Kembalikan tipe gambar yang diizinkan, atau null bila bukan JPEG/PNG/WEBP/GIF.
 * @param {Uint8Array} bytes
 * @returns {ImageKind | null}
 */
export function detectImageType(bytes) {
  // JPEG: FF D8 FF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", ext: "png" };
  }
  // GIF: "GIF87a" / "GIF89a"
  if (
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return { mime: "image/gif", ext: "gif" };
  }
  // WEBP: "RIFF" ???? "WEBP"
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}
