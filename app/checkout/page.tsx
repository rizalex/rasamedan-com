import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CheckoutView from "@/components/checkout/CheckoutView";
import { buildMetadata } from "@/lib/seo";

// Halaman transaksional: noindex.
export const metadata: Metadata = buildMetadata({
  title: "Checkout",
  description: "Selesaikan pesanan Anda dan lanjutkan ke WhatsApp untuk konfirmasi.",
  path: "/checkout",
  index: false,
});

export default function CheckoutPage() {
  return (
    <>
      <Header />
      <CheckoutView />
      <Footer />
    </>
  );
}
