"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useCart } from "@/components/cart/CartProvider";
import StockBadge from "@/components/product/StockBadge";
import {
  IconArrowLeft,
  IconCheck,
  IconWhatsApp,
  IconCake,
  IconSnack,
  IconBottle,
} from "@/components/ui/icons";
import { formatRupiah } from "@/lib/format";
import { buildWaLink } from "@/lib/whatsapp";
import type { Product } from "@/lib/products";
import styles from "./ProductDetail.module.css";

function CategoryIcon({ category }: { category: string }) {
  if (category === "kering") return <IconSnack size={52} />;
  if (category === "sirup") return <IconBottle size={52} />;
  return <IconCake size={52} />;
}

export default function ProductDetail({ product }: { product: Product }) {
  const { t } = useI18n();
  const { addItem } = useCart();
  const hasVariants = product.variants.length > 0;
  const [variant, setVariant] = useState<string | null>(
    hasVariants ? product.variants[0] : null
  );
  const [added, setAdded] = useState(false);

  const askStock = product.stock_status === "tanya-stok";
  const waLink = buildWaLink(
    `${t("whatsapp.askStock")} ${product.name}`
  );

  function handleAdd() {
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      variant,
      image: product.image,
      category: product.category,
      weight_grams: product.weight_grams,
    });
    setAdded(true);
  }

  return (
    <main className={styles.page}>
      <Link href="/produk" className={styles.back}>
        <IconArrowLeft size={18} />
        {t("detail.back")}
      </Link>

      <div className={styles.image}>
        {product.image ? (
          <Image
            src={product.image}
            alt={`${product.name} - Rasa Medan`}
            fill
            sizes="(max-width: 560px) 100vw, 560px"
            priority
            className={styles.photo}
            style={{ objectFit: "cover" }}
          />
        ) : (
          <span className={styles.placeholder} aria-hidden>
            <CategoryIcon category={product.category} />
          </span>
        )}
      </div>

      <div className={styles.body}>
        <p className={styles.category}>{t(`categories.${product.category}`)}</p>
        <h1 className={styles.name}>{product.name}</h1>
        <p className={styles.price}>{formatRupiah(product.price)}</p>

        <div className={styles.badges}>
          {product.is_halal && (
            <span className={styles.halal}>
              <IconCheck size={13} />
              {t("common.halal")}
            </span>
          )}
          <StockBadge status={product.stock_status} />
        </div>

        {hasVariants && (
          <div className={styles.section}>
            <p className={styles.label}>{t("common.chooseVariant")}</p>
            <div className={styles.variants}>
              {product.variants.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`${styles.variant} ${
                    variant === v ? styles.variantActive : ""
                  }`}
                  aria-pressed={variant === v}
                  onClick={() => setVariant(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {product.description && (
          <div className={styles.section}>
            <p className={styles.label}>{t("common.description")}</p>
            <p className={styles.text}>{product.description}</p>
          </div>
        )}

        {product.ingredients && (
          <div className={styles.section}>
            <p className={styles.label}>{t("common.ingredients")}</p>
            <p className={styles.muted}>{product.ingredients}</p>
          </div>
        )}

        {/* Aksi: Tanya Stok via WhatsApp bila status tanya-stok, selain itu Tambah ke Keranjang */}
        {askStock ? (
          <a
            className={`${styles.btn} ${styles.btnWa}`}
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconWhatsApp size={18} />
            {t("common.askStockWA")}
          </a>
        ) : (
          <>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleAdd}
            >
              {t("common.addToCart")}
            </button>
            {added && (
              <div className={styles.added} role="status">
                <span>
                  <IconCheck size={14} /> {t("detail.addedToCart")}
                </span>
                <Link href="/keranjang" className={styles.viewCart}>
                  {t("detail.viewCart")}
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
