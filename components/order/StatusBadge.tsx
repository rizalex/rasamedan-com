"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import styles from "./StatusBadge.module.css";

/** Daftar status baku PRD 2.1. */
export type OrderStatus =
  | "Menunggu Konfirmasi"
  | "Stok Dikonfirmasi"
  | "Menunggu Pembayaran"
  | "Pembayaran Diverifikasi"
  | "Dikemas"
  | "Dikirim"
  | "Siap Diambil"
  | "Selesai"
  | "Dibatalkan";

// Pengelompokan warna: menunggu (amber), proses (biru), selesai (hijau), batal (merah).
const CLASS: Record<OrderStatus, string> = {
  "Menunggu Konfirmasi": styles.waiting,
  "Menunggu Pembayaran": styles.waiting,
  "Stok Dikonfirmasi": styles.progress,
  "Pembayaran Diverifikasi": styles.progress,
  Dikemas: styles.progress,
  Dikirim: styles.progress,
  "Siap Diambil": styles.progress,
  Selesai: styles.done,
  Dibatalkan: styles.cancelled,
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useI18n();
  return (
    <span className={`${styles.badge} ${CLASS[status] ?? styles.waiting}`}>
      {t(`orderStatus.${status}`)}
    </span>
  );
}
