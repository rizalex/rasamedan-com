"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { StockStatus } from "@/lib/products";
import styles from "./StockBadge.module.css";

const CLASS: Record<StockStatus, string> = {
  tersedia: styles.available,
  terbatas: styles.limited,
  "pre-order": styles.preorder,
  "tanya-stok": styles.ask,
};

export default function StockBadge({ status }: { status: StockStatus }) {
  const { t } = useI18n();
  return (
    <span className={`${styles.badge} ${CLASS[status]}`}>
      {t(`stock.${status}`)}
    </span>
  );
}
