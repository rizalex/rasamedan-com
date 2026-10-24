import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AboutView from "@/components/support/AboutView";
import JsonLd from "@/components/seo/JsonLd";
import { buildMetadata, faqJsonLd } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Tentang Kami - Toko Oleh-oleh Khas Medan",
  description:
    "Toko oleh-oleh khas Medan milik keluarga di Tanjung Morawa dekat Bandara Kualanamu: kue, makanan kering, dan sirup. Info lokasi, pengiriman, dan FAQ.",
  path: "/tentang",
});

export default function AboutPage() {
  return (
    <>
      <JsonLd data={faqJsonLd()} />
      <Header />
      <AboutView />
      <Footer />
    </>
  );
}
