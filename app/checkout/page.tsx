import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CheckoutView from "@/components/checkout/CheckoutView";
import { buildMetadata } from "@/lib/seo";
import { getCaptchaSiteKey } from "@/lib/turnstile";

// Halaman transaksional: noindex.
export const metadata: Metadata = buildMetadata({
  title: "Checkout",
  description: "Selesaikan pesanan Anda dan lanjutkan ke WhatsApp untuk konfirmasi.",
  path: "/checkout",
  index: false,
});

// Dynamic: site key captcha dibaca dari env saat request (bukan NEXT_PUBLIC),
// konsisten dengan halaman login admin.
export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return (
    <>
      <Header />
      <CheckoutView captchaSiteKey={getCaptchaSiteKey()} />
      <Footer />
    </>
  );
}
