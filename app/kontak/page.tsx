import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ContactView from "@/components/support/ContactView";
import JsonLd from "@/components/seo/JsonLd";
import { buildMetadata, localBusinessJsonLd } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Kontak & Lokasi Toko",
  description:
    "Hubungi Rasa Medan via WhatsApp untuk pemesanan & pertanyaan. Lihat alamat toko, jam operasional, dan info pengambilan sendiri (pickup) di Medan.",
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
