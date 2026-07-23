"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import ProductCard from "@/components/product/ProductCard";
import TrustSection from "./TrustSection";
import StoreLocation from "./StoreLocation";
import {
  IconArrowUpRight,
  IconWhatsApp,
  IconCake,
  IconSnack,
  IconBottle,
} from "@/components/ui/icons";
import { buildWaLink } from "@/lib/whatsapp";
import type { Product } from "@/lib/products";
import type { Category } from "@/lib/categories";
import styles from "./HomeView.module.css";

// Ikon per kategori bawaan; kategori dinamis lain memakai ikon default.
const CATEGORY_ICONS: Record<string, typeof IconCake> = {
  kue: IconCake,
  kering: IconSnack,
  sirup: IconBottle,
};

export default function HomeView({
  featured,
  categories,
}: {
  featured: Product[];
  categories: Category[];
}) {
  const { t } = useI18n();

  // Label kategori: terjemahan i18n bila ada, selain itu nama dari DB.
  function categoryLabel(slug: string, name: string): string {
    const key = `categories.${slug}`;
    const translated = t(key);
    return translated === key ? name : translated;
  }

  const waLink = buildWaLink(t("home.waGreeting"));

  return (
    <>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroOrnament} aria-hidden />
        <div className={styles.heroInner}>
          <p className={styles.heroEyebrow}>{t("home.heroEyebrow")}</p>
          <h1 className={styles.heroTitle}>
            {t("home.heroTitle")}
            <br />
            <span className={styles.heroAccent}>{t("home.heroTitleAccent")}</span>
          </h1>
          <p className={styles.heroSubtitle}>{t("home.heroSubtitle")}</p>
          <div className={styles.heroCtas}>
            <Link href="/produk" className={styles.heroCtaPrimary}>
              {t("home.heroCtaProducts")}
              <IconArrowUpRight size={16} />
            </Link>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.heroCtaGhost}
            >
              <IconWhatsApp size={18} />
              {t("common.chatWa")}
            </a>
          </div>
        </div>
      </section>

      <main className={styles.main}>
        {/* Kategori */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("home.categoriesTitle")}</h2>
          <div className={styles.categoryGrid}>
            {categories.map((c) => {
              const Icon = CATEGORY_ICONS[c.slug] ?? IconCake;
              return (
                <Link
                  key={c.slug}
                  href={`/produk?category=${c.slug}`}
                  className={styles.categoryCard}
                >
                  <span className={styles.categoryIcon}>
                    <Icon size={28} />
                  </span>
                  <span className={styles.categoryLabel}>
                    {categoryLabel(c.slug, c.name)}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Keunggulan / Trust (5 ikon, statis) */}
        <section className={styles.section}>
          <TrustSection />
        </section>

        {/* Produk terlaris */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t("home.featuredTitle")}</h2>
            <Link href="/produk" className={styles.seeAll}>
              {t("common.viewAllProducts")}
              <IconArrowUpRight size={14} />
            </Link>
          </div>
          <div className={styles.productGrid}>
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        {/* Lokasi Toko + peta */}
        <StoreLocation />
      </main>
    </>
  );
}
