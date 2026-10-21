"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COURIERS, WAYBILL_PATTERN } from "@/lib/couriers.mjs";
import styles from "./admin.module.css";

/**
 * Kurir yang BENAR-BENAR dipakai + nomor resi, diisi setelah paket diserahkan ke
 * agen (Skill 22.2) — terpisah dari estimasi pilihan pelanggan (Skill 31), karena
 * kurir bisa berubah saat konfirmasi WhatsApp. Bila resi belum diisi, kurir
 * terisi otomatis dari pilihan pelanggan (Skill 32). Pilihan hanya kurir yang
 * aktif di admin → Kurir (ditambah kurir yang sudah tersimpan di pesanan).
 * Admin cukup Bahasa Indonesia (CLAUDE.md §4).
 */
export default function ShipmentForm({
  orderId,
  courierCode,
  waybill,
  suggestedCourier,
  enabledCodes,
}: {
  orderId: number;
  courierCode: string | null;
  waybill: string | null;
  /** Kode kurir lokal dari pilihan ongkir pelanggan, bila ada. */
  suggestedCourier: string | null;
  enabledCodes: string[];
}) {
  const router = useRouter();
  const prefilled = !courierCode && !!suggestedCourier;
  const [courier, setCourier] = useState(courierCode ?? suggestedCourier ?? "");
  const options = COURIERS.filter((c) => enabledCodes.includes(c.code) || c.code === courier);
  const [resi, setResi] = useState(waybill ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const value = resi.trim().toUpperCase();
    const clearing = !courier && !value;
    if (!clearing) {
      if (!courier) return setError("Pilih kurir.");
      if (!WAYBILL_PATTERN.test(value)) {
        return setError("Resi 6–40 karakter: huruf, angka, atau tanda -.");
      }
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courier_code: courier, waybill: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan resi");
      } else {
        setResi(value);
        setSaved(true);
        // Tidak memakai `key` remount: state lokal sudah sama dengan data server,
        // sehingga umpan balik "Tersimpan" tetap terlihat setelah refresh.
        router.refresh();
      }
    } catch {
      setError("Gagal menyimpan resi (koneksi)");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className={styles.shipmentForm}>
      <select
        className={styles.statusSelect}
        value={courier}
        onChange={(e) => setCourier(e.target.value)}
        aria-label="Kurir dikirim"
        disabled={saving}
      >
        <option value="">Kurir dikirim…</option>
        {options.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        className={styles.statusSelect}
        value={resi}
        onChange={(e) => setResi(e.target.value)}
        placeholder="No. resi pengiriman"
        aria-label="Nomor resi"
        maxLength={40}
        disabled={saving}
      />
      <button type="submit" className={styles.btnSmall} disabled={saving}>
        {saving ? "…" : "Simpan resi"}
      </button>
      {prefilled && !saved && !waybill && (
        <span className={styles.hint}>Kurir sesuai pilihan pelanggan — ganti bila berbeda.</span>
      )}
      {saved && <span className={styles.hint}>Tersimpan</span>}
      {error && (
        <div className={styles.errorText} role="alert">
          {error}
        </div>
      )}
    </form>
  );
}
