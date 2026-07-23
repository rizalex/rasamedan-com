/**
 * Helper SEO terpusat (Skill 19). Menyediakan:
 * - URL absolut situs (dari `NEXT_PUBLIC_SITE_URL`, wajib untuk canonical/OG/sitemap)
 * - Builder `Metadata` per halaman (title/description unik, canonical, OG, Twitter, hreflang id/en)
 * - Builder Structured Data (JSON-LD): Product, LocalBusiness, BreadcrumbList
 *
 * Metadata di-render server-side dalam bahasa default `id` (sesuai PRD 3.8) — toggle
 * id/en di UI bersifat client-side sehingga tiap URL menyajikan kedua bahasa (hreflang
 * menunjuk URL yang sama untuk id & en + x-default).
 */
import type { Metadata } from "next";
import type { Product } from "@/lib/products";
import { getStoreInfo } from "@/lib/store";
import { getWaNumber } from "@/lib/whatsapp";

export const SITE_NAME = "Rasa Medan";
export const SITE_TAGLINE = "Oleh-oleh Khas Medan";
const DEFAULT_OG_IMAGE = "/images/hero-medan.png";

/** Base URL situs tanpa trailing slash. Fallback ke localhost saat dev. */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/** Ubah path relatif jadi URL absolut (untuk canonical, OG image, sitemap). */
export function absoluteUrl(path = "/"): string {
  const base = getSiteUrl();
  if (!path || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Potong deskripsi agar ideal untuk meta description (±160 karakter). */
export function clampDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

type PageMetaInput = {
  title: string;
  description: string;
  /** Path relatif halaman (untuk canonical & hreflang), mis. "/produk". */
  path: string;
  /** Path gambar OG (relatif/absolut). Default: hero situs. */
  image?: string | null;
  type?: "website" | "article";
  /** Set false untuk halaman transaksional (keranjang/checkout) — noindex. */
  index?: boolean;
};

/**
 * Bangun objek `Metadata` lengkap untuk sebuah halaman: canonical, hreflang (id/en/
 * x-default menunjuk URL sama), Open Graph, dan Twitter Card.
 */
export function buildMetadata({
  title,
  description,
  path,
  image,
  type = "website",
  index = true,
}: PageMetaInput): Metadata {
  const url = absoluteUrl(path);
  const ogImage = absoluteUrl(image || DEFAULT_OG_IMAGE);
  const desc = clampDescription(description);

  return {
    title,
    description: desc,
    alternates: {
      canonical: url,
      languages: {
        id: url,
        en: url,
        "x-default": url,
      },
    },
    robots: index
      ? undefined
      : { index: false, follow: true },
    openGraph: {
      type,
      title,
      description: desc,
      url,
      siteName: SITE_NAME,
      locale: "id_ID",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [ogImage],
    },
  };
}

/** Peta status stok internal → nilai schema.org availability. */
function availabilityFor(status: Product["stock_status"]): string {
  switch (status) {
    case "tersedia":
      return "https://schema.org/InStock";
    case "pre-order":
      return "https://schema.org/PreOrder";
    case "terbatas":
    case "tanya-stok":
    default:
      return "https://schema.org/LimitedAvailability";
  }
}

/**
 * Structured Data Product (JSON-LD) untuk halaman detail produk — memungkinkan
 * Google menampilkan rich snippet (harga, ketersediaan, gambar).
 */
export function productJsonLd(
  product: Product,
  categoryName: string
): Record<string, unknown> {
  const url = absoluteUrl(`/produk/${product.slug}`);
  const description = clampDescription(
    product.description ||
      `${product.name} — ${categoryName} oleh-oleh khas Medan dari ${SITE_NAME}.`
  );

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description,
    category: categoryName,
    url,
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "IDR",
      availability: availabilityFor(product.stock_status),
      itemCondition: "https://schema.org/NewCondition",
      url,
      seller: { "@type": "Organization", name: SITE_NAME },
    },
  };
  if (product.image) data.image = [absoluteUrl(product.image)];
  if (product.variants.length > 0) {
    data.additionalProperty = {
      "@type": "PropertyValue",
      name: "Varian",
      value: product.variants.join(", "),
    };
  }
  return data;
}

const DAY_ID_TO_SCHEMA: Record<string, string> = {
  senin: "Monday",
  selasa: "Tuesday",
  rabu: "Wednesday",
  kamis: "Thursday",
  jumat: "Friday",
  "jum'at": "Friday",
  sabtu: "Saturday",
  minggu: "Sunday",
};
const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * Parse string jam buka Indonesia bebas (mis. "Kamis-Selasa 08.00-17.00 WIB")
 * menjadi OpeningHoursSpecification schema.org. Rentang hari yang membungkus
 * minggu (Kamis→Selasa) dijabarkan eksplisit sebagai daftar hari agar tetap valid.
 * Mengembalikan null bila string tidak dapat diparse (mis. "Tutup / by request").
 */
function parseOpeningHours(raw: string): Record<string, unknown> | null {
  const m = raw
    .toLowerCase()
    .match(
      /([a-zà-ÿ']+)\s*[–-]\s*([a-zà-ÿ']+)\s+(\d{1,2})[.:](\d{2})\s*[–-]\s*(\d{1,2})[.:](\d{2})/
    );
  if (!m) return null;
  const startDay = DAY_ID_TO_SCHEMA[m[1]];
  const endDay = DAY_ID_TO_SCHEMA[m[2]];
  if (!startDay || !endDay) return null;

  const days: string[] = [];
  let i = DAY_ORDER.indexOf(startDay);
  const end = DAY_ORDER.indexOf(endDay);
  for (let guard = 0; guard < 7; guard++) {
    days.push(DAY_ORDER[i]);
    if (i === end) break;
    i = (i + 1) % 7;
  }
  const opens = `${m[3].padStart(2, "0")}:${m[4]}`;
  const closes = `${m[5].padStart(2, "0")}:${m[6]}`;
  return {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: days.map((d) => `https://schema.org/${d}`),
    opens,
    closes,
  };
}

/**
 * Structured Data LocalBusiness (JSON-LD) — memakai info toko dari Skill 18
 * (nama, alamat, jam operasional, telepon, media sosial). Membantu Google Maps /
 * Google Business terhubung ke situs.
 */
export function localBusinessJsonLd(): Record<string, unknown> {
  const store = getStoreInfo();
  const siteUrl = getSiteUrl();
  const wa = getWaNumber();
  const sameAs = [store.instagram, store.tiktok, store.facebook].filter(Boolean);

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": `${siteUrl}/#store`,
    name: store.name,
    description: `${SITE_NAME} — ${SITE_TAGLINE}: kue, makanan kering, dan sirup khas Medan.`,
    url: `${siteUrl}/`,
    image: absoluteUrl(DEFAULT_OG_IMAGE),
    address: {
      "@type": "PostalAddress",
      streetAddress: store.address,
      addressLocality: "Medan",
      addressRegion: "Sumatera Utara",
      addressCountry: "ID",
    },
    priceRange: "Rp",
    servesCuisine: "Oleh-oleh Khas Medan",
  };
  if (wa) data.telephone = `+${wa}`;
  if (sameAs.length > 0) data.sameAs = sameAs;

  const spec = [store.hoursWeekday, store.hoursWeekend]
    .map((h) => parseOpeningHours(h))
    .filter((x): x is Record<string, unknown> => x !== null);
  if (spec.length > 0) data.openingHoursSpecification = spec;

  return data;
}

/** Structured Data BreadcrumbList (JSON-LD) — navigasi Beranda > … > Halaman. */
export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
