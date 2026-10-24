import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HomeView from "@/components/home/HomeView";
import JsonLd from "@/components/seo/JsonLd";
import { getFeaturedProducts } from "@/lib/products";
import { getAllCategories } from "@/lib/categories";
import {
  buildMetadata,
  HOME_TITLE,
  localBusinessJsonLd,
  websiteJsonLd,
} from "@/lib/seo";

// Beranda mengambil produk pilihan dari D1 saat request (butuh DB runtime).
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  // Judul absolut (bukan template layout) — kata kunci utama pencarian lokal.
  title: { absolute: HOME_TITLE },
  description:
    "Toko oleh-oleh khas Medan, Sumatera Utara: Bika Ambon, Kue Gulung, Kacang Sihobuk, Sirup Markisa. Dekat Bandara Kualanamu, kirim ke seluruh Indonesia.",
  path: "/",
});

export default async function HomePage() {
  const [featured, categories] = await Promise.all([
    getFeaturedProducts(6),
    getAllCategories(),
  ]);

  return (
    <>
      <JsonLd data={localBusinessJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      <Header />
      <HomeView featured={featured} categories={categories} />
      <Footer />
    </>
  );
}
