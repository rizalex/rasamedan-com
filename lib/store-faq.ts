import siteInfo from "@/data/site-info.json";

/**
 * Teks lokasi & FAQ toko (Skill 33) — data murni, aman untuk klien & server.
 * Teks dari locales (`home.seoText`, `support.locationText`, `support.faq{n}Q/A`);
 * placeholder {address}, {locality}, {landmark}, {hours} diisi dari
 * data/site-info.json agar alamat & jam buka tidak ditulis ganda. FAQ dipakai
 * AboutView (tampilan) dan FAQPage JSON-LD halaman /tentang (server, bahasa
 * default `id`) — isinya harus sama dengan yang tampil.
 */

export const FAQ_COUNT = 5;

type Translate = (key: string) => string;

export function fillStoreInfo(text: string): string {
  const c = siteInfo.contact;
  const hours = c.hours.map((h) => `${h.days} ${h.time}`).join(", ");
  // Replacer fungsi: nilai berisi "$&" dsb. tidak ditafsirkan sebagai pola.
  return text
    .replace(/\{address\}/g, () => c.address)
    .replace(/\{locality\}/g, () => c.locality)
    .replace(/\{landmark\}/g, () => c.landmark)
    .replace(/\{hours\}/g, () => hours);
}

export function storeFaq(t: Translate): { q: string; a: string }[] {
  return Array.from({ length: FAQ_COUNT }, (_, i) => ({
    q: fillStoreInfo(t(`support.faq${i + 1}Q`)),
    a: fillStoreInfo(t(`support.faq${i + 1}A`)),
  }));
}
