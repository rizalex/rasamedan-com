/**
 * Deteksi tipe gambar dari isi file (magic bytes) — Skill 21.2 no. 6.
 * JANGAN percaya `file.type` atau ekstensi dari klien: keduanya bisa dipalsukan.
 * Portabel (hanya Uint8Array): dipakai ulang saat upload pindah ke R2 (Skill 27).
 */
export type ImageKind = { mime: string; ext: string };

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

/** Kembalikan tipe gambar yang diizinkan, atau null bila bukan JPEG/PNG/WEBP/GIF. */
export function detectImageType(bytes: Uint8Array): ImageKind | null {
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
