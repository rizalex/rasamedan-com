/**
 * Daftar kurir untuk lacak pengiriman (Skill 22). Data murni tanpa dependensi:
 * aman untuk klien, server, dan skrip.
 *
 * `trackUrl` = halaman lacak RESMI kurir (pelanggan menempel nomor resi di
 * sana). URL diverifikasi 14 Okt 2026 (HTTP 200, bukan dialihkan ke beranda),
 * kecuali SiCepat: halaman lacaknya ada di beranda (/checkAwb dialihkan ke sana).
 * Kode kurir api.co.id tidak dipetakan: uji 22.0 (21 Okt 2026) → Jalur B, tracking api.co.id
 * hanya untuk pesanan yang dibuat lewat API mereka (lihat SKILLS.md 22a).
 */

/** @typedef {{ code: string, name: string, trackUrl: string | null }} Courier */

/** @type {readonly Courier[]} */
export const COURIERS = Object.freeze([
  { code: "jne", name: "JNE", trackUrl: "https://www.jne.co.id/tracking-package" },
  { code: "jnt", name: "J&T Express", trackUrl: "https://jet.co.id/track" },
  { code: "sicepat", name: "SiCepat", trackUrl: "https://www.sicepat.com/" },
  { code: "anteraja", name: "AnterAja", trackUrl: "https://anteraja.id/tracking" },
  { code: "pos", name: "Pos Indonesia", trackUrl: "https://www.posindonesia.co.id/id/tracking" },
  { code: "ninja", name: "Ninja Xpress", trackUrl: "https://www.ninjaxpress.co/id-id/tracking" },
  { code: "lion", name: "Lion Parcel", trackUrl: "https://lionparcel.com/track/stt" },
  { code: "idexpress", name: "ID Express", trackUrl: "https://idexpress.com/lacak-paket" },
  // Kurir lokal/instan tanpa halaman lacak publik: resi tetap ditampilkan.
  { code: "lainnya", name: "Kurir lain", trackUrl: null },
]);

/** Format nomor resi yang diterima (SKILLS 22.2); minimal satu huruf/angka. */
export const WAYBILL_PATTERN = /^(?=.*[A-Za-z0-9])[A-Za-z0-9-]{6,40}$/;

/**
 * @param {string | null | undefined} code
 * @returns {Courier | null}
 */
export function findCourier(code) {
  return COURIERS.find((c) => c.code === code) ?? null;
}
