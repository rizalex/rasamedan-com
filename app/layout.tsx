import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { CartProvider } from "@/components/cart/CartProvider";
import { getSiteUrl, SITE_NAME, SITE_TAGLINE } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  // metadataBase membuat semua canonical/OG URL relatif jadi absolut (butuh untuk SEO).
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${SITE_NAME} - ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Katalog oleh-oleh khas Medan: kue, makanan kering, dan sirup. Pesan mudah tanpa akun, konfirmasi via WhatsApp.",
  applicationName: SITE_NAME,
  keywords: [
    "oleh-oleh Medan",
    "oleh-oleh khas Medan",
    "kue Medan",
    "Bika Ambon",
    "Kacang Sihobuk",
    "Sirup Markisa",
    "camilan Medan",
    "Rasa Medan",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  // Verifikasi kepemilikan Google Search Console (Skill 19.8): isi token via
  // env GOOGLE_SITE_VERIFICATION saat mendaftarkan situs. Kosong = tidak dirender.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "id_ID",
    title: `${SITE_NAME} - ${SITE_TAGLINE}`,
    description:
      "Katalog oleh-oleh khas Medan: kue, makanan kering, dan sirup. Pesan mudah tanpa akun, konfirmasi via WhatsApp.",
    images: [{ url: "/images/hero-medan.png", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - ${SITE_TAGLINE}`,
    description:
      "Katalog oleh-oleh khas Medan: kue, makanan kering, dan sirup. Pesan mudah tanpa akun, konfirmasi via WhatsApp.",
    images: ["/images/hero-medan.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#14432E",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Default bahasa `id` (sesuai PRD 3.8). Toggle id/en dikelola I18nProvider (client).
  return (
    <html lang="id">
      <body>
        <I18nProvider>
          <CartProvider>{children}</CartProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
