/**
 * Info toko (Skill 18) — dibaca dari environment `NEXT_PUBLIC_*` agar bisa
 * diganti saat deploy cPanel tanpa ubah kode. Setiap variabel dirujuk eksplisit
 * supaya Next.js meng-inline nilainya (berlaku di server & client component).
 */
export interface StoreInfo {
  name: string;
  address: string;
  mapsEmbedUrl: string;
  mapsLinkUrl: string;
  hoursWeekday: string;
  hoursWeekend: string;
  instagram: string;
  tiktok: string;
  facebook: string;
}

export function getStoreInfo(): StoreInfo {
  return {
    name: process.env.NEXT_PUBLIC_STORE_NAME || "Rasa Medan",
    address:
      process.env.NEXT_PUBLIC_STORE_ADDRESS || "Medan, Sumatera Utara, Indonesia",
    mapsEmbedUrl: process.env.NEXT_PUBLIC_MAPS_EMBED_URL || "",
    mapsLinkUrl: process.env.NEXT_PUBLIC_MAPS_LINK_URL || "",
    hoursWeekday: process.env.NEXT_PUBLIC_STORE_HOURS_WEEKDAY || "",
    hoursWeekend: process.env.NEXT_PUBLIC_STORE_HOURS_WEEKEND || "",
    instagram: process.env.NEXT_PUBLIC_IG_URL || "",
    tiktok: process.env.NEXT_PUBLIC_TIKTOK_URL || "",
    facebook: process.env.NEXT_PUBLIC_FB_URL || "",
  };
}
