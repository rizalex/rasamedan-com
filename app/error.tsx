"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

/**
 * Halaman error umum (mis. database sedang tidak tersedia di production —
 * katalog sengaja tidak jatuh ke data dummy, lihat lib/products.ts).
 * Detail error tidak ditampilkan ke pengunjung; sudah tercatat di log server.
 */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
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
        <h1 style={{ fontSize: 20, margin: "8px 0 6px" }}>{t("errorPage.title")}</h1>
        <p style={{ color: "var(--color-muted)", fontSize: 14, margin: "0 0 20px" }}>
          {t("errorPage.message")}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "var(--color-primary)",
              color: "var(--color-bg)",
              border: "none",
              padding: "11px 22px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {t("errorPage.retry")}
          </button>
          <Link
            href="/"
            style={{
              display: "inline-block",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              padding: "11px 22px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {t("notFound.backHome")}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
