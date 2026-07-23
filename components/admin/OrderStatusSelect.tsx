"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";

const STATUSES = [
  "Menunggu Konfirmasi",
  "Stok Dikonfirmasi",
  "Menunggu Pembayaran",
  "Pembayaran Diverifikasi",
  "Dikemas",
  "Dikirim",
  "Siap Diambil",
  "Selesai",
  "Dibatalkan",
];

export default function OrderStatusSelect({
  orderId,
  current,
}: {
  orderId: number;
  current: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(current);
  const [saving, setSaving] = useState(false);

  async function change(next: string) {
    const prev = status;
    setStatus(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        setStatus(prev); // rollback tampilan bila gagal
      } else {
        router.refresh(); // reflect ke daftar & ke halaman cek-pesanan pelanggan
      }
    } catch {
      setStatus(prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      className={styles.statusSelect}
      value={status}
      disabled={saving}
      onChange={(e) => change(e.target.value)}
      aria-label="Ubah status pesanan"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
