import siteInfo from "@/data/site-info.json";

/**
 * Konten SEO & FAQ beranda (Skill 33) — data murni, aman untuk klien & server.
 * Teks dari locales (`home.seoP*`, `home.faq{n}Q/A`); placeholder {address},
 * {locality}, {landmark}, {hours} diisi dari data/site-info.json agar alamat &
 * jam buka tidak ditulis ganda. Dipakai HomeView (tampilan) dan FAQPage JSON-LD
 * (server, bahasa default `id`) — isinya harus sama dengan yang tampil.
 */

export const FAQ_COUNT = 5;

type Translate = (key: string) => string;

function fill(text: string): string {
  const c = siteInfo.contact;
  const hours = c.hours.map((h) => `${h.days} ${h.time}`).join(", ");
  // Replacer fungsi: nilai berisi "$&" dsb. tidak ditafsirkan sebagai pola.
  return text
    .replace(/\{address\}/g, () => c.address)
    .replace(/\{locality\}/g, () => c.locality)
    .replace(/\{landmark\}/g, () => c.landmark)
    .replace(/\{hours\}/g, () => hours);
}

export function homeSeoParagraphs(t: Translate): string[] {
  return [fill(t("home.seoP1")), fill(t("home.seoP2"))];
}

export function homeFaq(t: Translate): { q: string; a: string }[] {
  return Array.from({ length: FAQ_COUNT }, (_, i) => ({
    q: fill(t(`home.faq${i + 1}Q`)),
    a: fill(t(`home.faq${i + 1}A`)),
  }));
}
