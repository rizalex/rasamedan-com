"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useCart } from "@/components/cart/CartProvider";
import { formatRupiah, formatWeight } from "@/lib/format";
import {
  IconPlus,
  IconMinus,
  IconTrash,
  IconCake,
  IconSnack,
  IconBottle,
} from "@/components/ui/icons";
import styles from "./CartView.module.css";

function Thumb({
  category,
  image,
  name,
}: {
  category: string;
  image: string | null;
  name: string;
}) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={name} className={styles.thumbImg} />;
  }
  const Icon =
    category === "kering" ? IconSnack : category === "sirup" ? IconBottle : IconCake;
  return (
    <span className={styles.thumbIcon} aria-hidden>
      <Icon size={22} />
    </span>
  );
}

export default function CartView() {
  const { t } = useI18n();
  const { items, hydrated, subtotal, count, totalWeight, setQuantity, removeItem } =
    useCart();

  // Hindari flash "keranjang kosong" sebelum localStorage terbaca.
  if (!hydrated) {
    return <main className={styles.page} aria-busy="true" />;
  }

  if (items.length === 0) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>{t("cart.title")}</h1>
        <div className={styles.empty}>
          <p>{t("cart.empty")}</p>
          <Link href="/produk" className={styles.emptyCta}>
            {t("cart.emptyCta")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>
        {t("cart.title")} <span className={styles.count}>({count})</span>
      </h1>

      <ul className={styles.list}>
        {items.map((it) => (
          <li key={`${it.productId}::${it.variant ?? ""}`} className={styles.item}>
            <div className={styles.thumb}>
              <Thumb category={it.category} image={it.image} name={it.name} />
            </div>

            <div className={styles.info}>
              <Link href={`/produk/${it.slug}`} className={styles.name}>
                {it.name}
              </Link>
              {it.variant && <p className={styles.variant}>{it.variant}</p>}
              <p className={styles.unit}>{formatRupiah(it.price)}</p>
            </div>

            <div className={styles.controls}>
              <div className={styles.stepper}>
                <button
                  type="button"
                  aria-label={t("cart.decrease")}
                  onClick={() =>
                    setQuantity(it.productId, it.variant, it.quantity - 1)
                  }
                >
                  <IconMinus size={15} />
                </button>
                <span className={styles.qty}>{it.quantity}</span>
                <button
                  type="button"
                  aria-label={t("cart.increase")}
                  onClick={() =>
                    setQuantity(it.productId, it.variant, it.quantity + 1)
                  }
                >
                  <IconPlus size={15} />
                </button>
              </div>
              <p className={styles.lineTotal}>
                {formatRupiah(it.price * it.quantity)}
              </p>
              <button
                type="button"
                className={styles.remove}
                aria-label={t("cart.remove")}
                onClick={() => removeItem(it.productId, it.variant)}
              >
                <IconTrash size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className={styles.summary}>
        <div className={styles.subtotalRow}>
          <span>{t("common.subtotal")}</span>
          <strong>{formatRupiah(subtotal)}</strong>
        </div>
        {totalWeight > 0 && (
          <div className={styles.subtotalRow}>
            <span>{t("common.weightEstimate")}</span>
            <span>{formatWeight(totalWeight)}</span>
          </div>
        )}
        <p className={styles.note}>{t("cart.shippingNote")}</p>
        <Link href="/checkout" className={styles.checkout}>
          {t("common.checkout")}
        </Link>
      </div>
    </main>
  );
}
