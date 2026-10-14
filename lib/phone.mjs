/**
 * Normalisasi nomor HP Indonesia ke format lokal `08…` (hanya digit).
 * Dipakai saat menyimpan pesanan dan saat Cek Pesanan, agar "0812-3456-7890",
 * "+62 812 3456 7890" dan "081234567890" dianggap nomor yang sama.
 * Aman untuk klien (tanpa dependensi). JS murni (.mjs) agar dipakai juga skrip
 * ekspor data cPanel (scripts/export-mysql.mjs, Skill 25).
 * @param {string} input
 * @returns {string}
 */
export function normalizePhone(input) {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2); // awalan internasional 0062…
  if (digits.startsWith("62")) digits = "0" + digits.slice(2);
  else if (digits.startsWith("8")) digits = "0" + digits;
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
