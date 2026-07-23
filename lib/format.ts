/** Helper format tampilan. */

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Format angka Rupiah, mis. 45000 -> "Rp45.000". */
export function formatRupiah(value: number): string {
  return rupiah.format(value).replace(/\s/g, "");
}

/**
 * Format berat, mis. 850 -> "850 gram", 1300 -> "1,3 kg".
 * Pakai gram di bawah 1 kg, kg dengan desimal koma di atasnya (Skill 13).
 */
export function formatWeight(grams: number): string {
  const g = Math.max(0, Math.round(grams));
  if (g < 1000) return `${g} gram`;
  const kg = (g / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 });
  return `${kg} kg`;
}

/** Format tanggal+jam sesuai locale, mis. "7 Jul 2026, 21.05". */
export function formatDateTime(value: string | Date, locale: string = "id"): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
