"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <>
      <Header />
      <main
        style={{
          maxWidth: 480,
          margin: "0 auto",
          padding: "60px 20px",
          textAlign: "center",
          minHeight: "45vh",
        }}
      >
        <p style={{ fontSize: 48, fontWeight: 700, color: "var(--color-accent)", margin: 0 }}>
          404
        </p>
        <h1 style={{ fontSize: 20, margin: "8px 0 6px" }}>{t("notFound.title")}</h1>
        <p style={{ color: "var(--color-muted)", fontSize: 14, margin: "0 0 20px" }}>
          {t("notFound.message")}
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            background: "var(--color-primary)",
            color: "var(--color-bg)",
            padding: "11px 22px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {t("notFound.backHome")}
        </Link>
      </main>
      <Footer />
    </>
  );
}
