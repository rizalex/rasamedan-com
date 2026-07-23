/**
 * Helper integrasi WhatsApp (wa.me). Nomor tujuan diambil dari environment
 * `NEXT_PUBLIC_WA_NUMBER` (aturan bisnis #6: JANGAN hardcode nomor).
 */

/** Nomor WA UTAMA — khusus pemesanan (format internasional tanpa `+`), mis. 6281200000000. */
export function getWaNumber(): string {
  return process.env.NEXT_PUBLIC_WA_NUMBER ?? "";
}

/**
 * Nomor WA ALTERNATIF — layanan pelanggan / pertanyaan umum, agar nomor utama
 * tetap fokus untuk pemesanan. Opsional: kembalikan "" bila tidak dikonfigurasi.
 */
export function getWaNumberAlt(): string {
  return process.env.NEXT_PUBLIC_WA_NUMBER_ALT ?? "";
}

/** Bangun link wa.me dengan teks ter-encode dengan benar. */
export function buildWaLink(text: string, number: string = getWaNumber()): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
