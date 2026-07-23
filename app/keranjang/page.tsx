import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CartView from "@/components/cart/CartView";
import { buildMetadata } from "@/lib/seo";

// Halaman transaksional: tanpa konten unik untuk diindeks → noindex.
export const metadata: Metadata = buildMetadata({
  title: "Keranjang",
  description: "Ringkasan keranjang belanja Anda di Rasa Medan.",
  path: "/keranjang",
  index: false,
});

export default function CartPage() {
  return (
    <>
      <Header />
      <CartView />
      <Footer />
    </>
  );
}
