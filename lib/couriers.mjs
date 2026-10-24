/**
 * Daftar kurir (Skill 22 lacak pengiriman, Skill 31/32 estimasi ongkir). Data murni
 * tanpa dependensi: aman untuk klien, server, dan skrip.
 *
 * - `trackUrl` = halaman lacak RESMI kurir (pelanggan menempel nomor resi di
 *   sana). Diverifikasi HTTP 200 (14 Okt 2026; SAP/Paxel/SPX/J&T Cargo 21 Okt 2026).
 *   SiCepat & J&T Cargo: formulir lacak ada di beranda (/tracking dialihkan ke sana).
 * - `apiCode` = `courier_code` api.co.id (daftar `GET /courier/v1/couriers`, SKILLS
 *   31b) untuk memetakan pilihan ongkir pelanggan ke kurir di admin. null = tidak
 *   ada di api.co.id (tidak muncul di estimasi ongkir).
 * Tracking via api.co.id tidak dipakai: hanya untuk pesanan yang dibuat lewat API
 * mereka (SKILLS.md 22a).
 */

/** @typedef {{ code: string, name: string, trackUrl: string | null, apiCode: string | null }} Courier */

/** @type {readonly Courier[]} */
export const COURIERS = Object.freeze([
  { code: "jne", name: "JNE", trackUrl: "https://www.jne.co.id/tracking-package", apiCode: "jne" },
  { code: "jnt", name: "J&T Express", trackUrl: "https://jet.co.id/track", apiCode: "jnt" },
  { code: "jntcargo", name: "J&T Cargo", trackUrl: "https://www.jtcargo.id/", apiCode: "jnt_cargo" },
  { code: "sicepat", name: "SiCepat", trackUrl: "https://www.sicepat.com/", apiCode: "sicepat" },
  { code: "anteraja", name: "AnterAja", trackUrl: "https://anteraja.id/tracking", apiCode: "anteraja" },
  { code: "pos", name: "Pos Indonesia", trackUrl: "https://www.posindonesia.co.id/id/tracking", apiCode: null },
  { code: "ninja", name: "Ninja Xpress", trackUrl: "https://www.ninjaxpress.co/id-id/tracking", apiCode: "ninja" },
  { code: "lion", name: "Lion Parcel", trackUrl: "https://lionparcel.com/track/stt", apiCode: "lion" },
  { code: "idexpress", name: "ID Express", trackUrl: "https://idexpress.com/lacak-paket", apiCode: "idx" },
  { code: "sap", name: "SAP Express", trackUrl: "https://www.sapx.id/id/cek-awb", apiCode: "sap" },
  { code: "paxel", name: "Paxel", trackUrl: "https://paxel.co/id/lacak-pengiriman", apiCode: "paxel" },
  { code: "spx", name: "SPX Express", trackUrl: "https://spx.co.id/track", apiCode: "spx" },
  // Kurir lokal/instan tanpa halaman lacak publik: resi tetap ditampilkan.
  { code: "lainnya", name: "Kurir lain", trackUrl: null, apiCode: null },
]);

/** Kode "Kurir lain" — selalu tersedia di admin (tidak bisa dinonaktifkan). */
export const OTHER_COURIER_CODE = "lainnya";

/** Format nomor resi yang diterima (SKILLS 22.2); minimal satu huruf/angka. */
export const WAYBILL_PATTERN = /^(?=.*[A-Za-z0-9])[A-Za-z0-9-]{6,40}$/;

/**
 * @param {string | null | undefined} code
 * @returns {Courier | null}
 */
export function findCourier(code) {
  return COURIERS.find((c) => c.code === code) ?? null;
}

/**
 * Kurir lokal untuk `courier_code` api.co.id (pilihan ongkir pelanggan).
 * @param {string | null | undefined} apiCode
 * @returns {Courier | null}
 */
export function findCourierByApiCode(apiCode) {
  if (!apiCode) return null;
  return COURIERS.find((c) => c.apiCode === apiCode) ?? null;
}
