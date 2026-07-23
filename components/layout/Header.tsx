"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useCart } from "@/components/cart/CartProvider";
import { IconCart, IconSearch, IconWhatsApp, IconTruck } from "@/components/ui/icons";
import { buildWaLink } from "@/lib/whatsapp";
import { locales } from "@/lib/i18n";
import styles from "./Header.module.css";

export default function Header() {
  const { locale, setLocale, t } = useI18n();
  const { count, hydrated } = useCart();
  const router = useRouter();
  const [term, setTerm] = useState("");

  const waLink = buildWaLink(t("home.waGreeting"));

  const navLinks = [
    { href: "/", label: t("nav.home") },
    { href: "/produk", label: t("nav.catalog") },
    { href: "/kontak", label: t("nav.locations") },
    { href: "/tentang", label: t("nav.about") },
    { href: "/cek-pesanan", label: t("nav.checkOrder") },
  ];

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = term.trim();
    router.push(q ? `/produk?q=${encodeURIComponent(q)}` : "/produk");
  }

  return (
    <header className={styles.header}>
      {/* Bar pengumuman (hijau paling gelap) */}
      <div className={styles.announce}>
        <div className={styles.announceInfo}>
          <span className={styles.announceItem}>
            <IconTruck size={15} />
            {t("header.announceDelivery")}
          </span>
          <span className={styles.announceItem}>
            <IconWhatsApp size={15} />
            {t("header.announceWa")}
          </span>
        </div>
        <div className={styles.announceActions}>
          <div className={styles.langToggle} role="group" aria-label="Language">
            {locales.map((l, i) => (
              <span key={l} className={styles.langItem}>
                {i > 0 && <span className={styles.sep}>|</span>}
                <button
                  type="button"
                  onClick={() => setLocale(l)}
                  aria-pressed={locale === l}
                  className={`${styles.langBtn} ${locale === l ? styles.langActive : ""}`}
                >
                  {l.toUpperCase()}
                </button>
              </span>
            ))}
          </div>
          <Link href="/keranjang" className={styles.cartBtn} aria-label={t("nav.cart")}>
            <IconCart size={17} />
            <span>{t("nav.cart")}</span>
            {hydrated && count > 0 && (
              <span className={styles.cartBadge} aria-hidden>
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Bar utama (krem): logo, nav, search, WhatsApp */}
      <div className={styles.main}>
        <Link href="/" className={styles.brand} aria-label={t("common.brand")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/rasa-medan-lockup.svg"
            alt={t("common.brand")}
            className={styles.logo}
          />
        </Link>

        <nav className={styles.nav}>
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className={styles.navLink}>
              {l.label}
            </Link>
          ))}
        </nav>

        <form className={styles.searchWrap} onSubmit={submitSearch} role="search">
          <input
            type="search"
            className={styles.search}
            placeholder={t("common.search")}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label={t("common.search")}
          />
          <button type="submit" className={styles.searchBtn} aria-label={t("common.search")}>
            <IconSearch size={18} />
          </button>
        </form>

        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.waBtn}
        >
          <IconWhatsApp size={18} />
          <span>{t("common.chatWa")}</span>
        </a>
      </div>
    </header>
  );
}
