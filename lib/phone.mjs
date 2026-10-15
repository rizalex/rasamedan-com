/**
 * Normalisasi nomor HP Indonesia ke format lokal `08…` (hanya digit).
 * Dipakai saat menyimpan pesanan dan saat Cek Pesanan, agar "0812-3456-7890",
 * "+62 812 3456 7890" dan "081234567890" dianggap nomor yang sama.
 * Aman untuk klien (tanpa dependensi). JS murni (.mjs) agar dipakai juga skrip
 * ekspor data cPanel (scripts/export-mysql.mjs, Skill 25).
 *
 * Awalan "62" diperlakukan sebagai kode negara hanya bila jelas internasional:
 * diketik dengan "+"/"00", atau diikuti 8 (seluler, mis. "62812…"). Tanpa itu,
 * "622…" adalah telepon rumah berkode area 0622 (Siantar) yang diketik tanpa 0
 * — dulu salah diubah menjadi "022…" (Bandung), nomor orang lain.
 * @param {string} input
 * @returns {string}
 */
export function normalizePhone(input) {
  const raw = String(input ?? "").trim();
  let digits = raw.replace(/\D/g, "");
  const international = raw.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2); // awalan internasional 0062…
  // Nomor luar negeri (+1…, 0044…) bukan nomor Indonesia: kembalikan apa adanya
  // tanpa awalan 0 → isValidPhone menolak (dulu ikut "diperbaiki" jadi 01…).
  if (international && !digits.startsWith("62")) return digits;
  if (digits.startsWith("62") && (international || digits[2] === "8")) {
    digits = "0" + digits.slice(2);
  } else if (!digits.startsWith("0")) {
    digits = "0" + digits; // "812…" / "622…" tanpa 0 di depan
  }
  return digits;
}

/**
 * Nomor HP dianggap valid bila 9–15 digit setelah normalisasi dan diawali 0.
 * @param {string} normalized
 * @returns {boolean}
 */
export function isValidPhone(normalized) {
  return /^0\d{8,14}$/.test(normalized);
}
