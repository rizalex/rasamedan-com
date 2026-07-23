import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HomeView from "@/components/home/HomeView";
import JsonLd from "@/components/seo/JsonLd";
import { getFeaturedProducts } from "@/lib/products";
import { getAllCategories } from "@/lib/categories";
import { buildMetadata, localBusinessJsonLd, SITE_TAGLINE } from "@/lib/seo";

// Beranda mengambil produk pilihan dari MySQL saat request (butuh DB runtime).
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: `Rasa Medan - ${SITE_TAGLINE}`,
  description:
    "Belanja oleh-oleh khas Medan: Bika Ambon, Kacang Sihobuk, Sirup Markisa, dan camilan lainnya. Pesan tanpa akun, konfirmasi cepat via WhatsApp, pengiriman next-day.",
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
      <Header />
      <HomeView featured={featured} categories={categories} />
      <Footer />
    </>
  );
}
