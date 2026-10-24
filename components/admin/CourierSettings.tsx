"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";

type CourierRow = { code: string; name: string; trackUrl: string | null; inRates: boolean; enabled: boolean };

/** Jumlah kurir ber-tarif yang tetap aktif bila `code` dinonaktifkan. */
function ratedLeftAfterDisable(rows: CourierRow[], code: string): number {
  return rows.filter((r) => r.inRates && r.enabled && r.code !== code).length;
}

/**
 * Aktif/nonaktifkan kurir agen yang dipakai toko (Skill 32).
 * Admin cukup Bahasa Indonesia (CLAUDE.md §4).
 */
export default function CourierSettings({ couriers }: { couriers: CourierRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(couriers);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(code: string, enabled: boolean) {
    setError(null);
    if (!enabled && ratedLeftAfterDisable(rows, code) === 0) {
      setError("Minimal satu kurir dengan estimasi ongkir harus tetap aktif.");
      return;
    }
    setBusy(code);
    try {
      const res = await fetch("/api/admin/couriers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan");
      } else {
        setRows((rs) => rs.map((r) => (r.code === code ? { ...r, enabled } : r)));
        router.refresh();
      }
    } catch {
      setError("Gagal menyimpan (koneksi)");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Kurir</th>
              <th>Estimasi ongkir</th>
              <th>Halaman lacak</th>
              <th>Aktif</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <td>
                  <strong>{r.name}</strong>
                </td>
                <td className={styles.hint}>{r.inRates ? "Ya (api.co.id)" : "Tidak tersedia"}</td>
                <td className={styles.hint}>
                  {r.trackUrl ? (
                    <a href={r.trackUrl} target="_blank" rel="noopener noreferrer">
                      Buka ↗
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      disabled={busy !== null}
                      onChange={(e) => toggle(r.code, e.target.checked)}
                      aria-label={`Aktifkan ${r.name}`}
                    />
                    {busy === r.code ? "…" : r.enabled ? "Aktif" : "Nonaktif"}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
