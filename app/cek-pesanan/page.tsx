import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CheckOrderView from "@/components/order/CheckOrderView";
import { getCaptchaSiteKey } from "@/lib/turnstile";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

// Alat lookup status (data personal): noindex.
export const metadata: Metadata = buildMetadata({
  title: "Cek Status Pesanan",
  description: "Lacak status pesanan Rasa Medan Anda dengan nomor HP dan Order ID.",
  path: "/cek-pesanan",
  index: false,
});

export default function CheckOrderPage() {
  // Site key dikirim dari server (bukan NEXT_PUBLIC) agar bisa diganti tanpa build ulang.
  const captchaSiteKey = getCaptchaSiteKey();
  return (
    <>
      <Header />
      <CheckOrderView captchaSiteKey={captchaSiteKey} />
      <Footer />
    </>
  );
}
