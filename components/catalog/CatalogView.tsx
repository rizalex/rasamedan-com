"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import ProductCard from "@/components/product/ProductCard";
import { IconSearch } from "@/components/ui/icons";
import type { Product } from "@/lib/products";
import type { Category } from "@/lib/categories";
import styles from "./CatalogView.module.css";

export default function CatalogView({
  products,
  categories,
  initialCategory = "all",
  initialQuery = "",
}: {
  products: Product[];
  categories: Category[];
  initialCategory?: string;
  initialQuery?: string;
}) {
  const { t } = useI18n();

  // Filter tersedia: "all" + kategori dinamis dari DB.
  const validSlugs = useMemo(
    () => new Set(["all", ...categories.map((c) => c.slug)]),
    [categories]
  );
  const [category, setCategory] = useState<string>(
    validSlugs.has(initialCategory) ? initialCategory : "all"
  );
  const [term, setTerm] = useState(initialQuery);

  // Label kategori: pakai terjemahan i18n bila ada (Kue→Cakes), selain itu nama dari DB.
  function categoryLabel(slug: string, name: string): string {
    const key = `categories.${slug}`;
    const translated = t(key);
    return translated === key ? name : translated;
  }
  const chips = [{ slug: "all", name: t("categories.all") }, ...categories];

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    return products.filter((p) => {
      const matchCategory = category === "all" || p.category === category;
      const matchTerm = q === "" || p.name.toLowerCase().includes(q);
      return matchCategory && matchTerm;
    });
  }, [products, category, term]);

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t("catalog.title")}</h1>

      {/* Search bar */}
      <div className={styles.searchWrap}>
        <IconSearch size={18} />
        <input
          type="search"
          className={styles.search}
          placeholder={t("common.search")}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          aria-label={t("common.search")}
        />
      </div>

      {/* Filter kategori (chip) */}
      <div className={styles.chips} role="tablist" aria-label={t("home.categoriesTitle")}>
        {chips.map((c) => (
          <button
            key={c.slug}
            type="button"
            role="tab"
            aria-selected={category === c.slug}
            className={`${styles.chip} ${category === c.slug ? styles.chipActive : ""}`}
            onClick={() => setCategory(c.slug)}
          >
            {c.slug === "all" ? c.name : categoryLabel(c.slug, c.name)}
          </button>
        ))}
      </div>

      {/* Grid produk */}
      {filtered.length > 0 ? (
        <div className={styles.grid}>
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <p className={styles.empty}>{t("catalog.empty")}</p>
      )}
    </main>
  );
}
