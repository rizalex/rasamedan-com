import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ContactView from "@/components/support/ContactView";
import JsonLd from "@/components/seo/JsonLd";
import { buildMetadata, localBusinessJsonLd } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Lokasi Toko Oleh-oleh dekat Bandara Kualanamu",
  description:
    "Alamat toko oleh-oleh Rasa Medan di Jl. Bandara Kualanamu, Tanjung Morawa, Sumatera Utara. Lihat peta, jam buka, pickup, dan pesan via WhatsApp.",
  path: "/kontak",
});

export default function ContactPage() {
  return (
    <>
      <JsonLd data={localBusinessJsonLd()} />
      <Header />
      <ContactView />
      <Footer />
    </>
  );
}
