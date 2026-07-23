import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AboutView from "@/components/support/AboutView";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Tentang Kami",
  description:
    "Rasa Medan adalah usaha keluarga penjual oleh-oleh khas Medan — kue, makanan kering, dan sirup — dibuat segar dengan resep turun-temurun.",
  path: "/tentang",
});

export default function AboutPage() {
  return (
    <>
      <Header />
      <AboutView />
      <Footer />
    </>
  );
}
