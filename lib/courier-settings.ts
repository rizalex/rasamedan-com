import { dbErrorMessage, execute, query } from "@/lib/db";
import { COURIERS, OTHER_COURIER_CODE, findCourierByApiCode } from "@/lib/couriers.mjs";

/**
 * Kurir agen yang dipakai toko (Skill 32) — server-only (D1).
 * Tabel `courier_settings`: tidak ada baris = aktif. "Kurir lain" selalu aktif.
 */

/**
 * Kode kurir lokal yang dinonaktifkan admin. Gagal baca (mis. migrasi 0005 belum
 * diterapkan) → semua kurir dianggap aktif (default), agar checkout & daftar
 * pesanan tidak ikut gagal — ini preferensi tampilan, bukan kontrol keamanan.
 */
export async function getDisabledCourierCodes(): Promise<Set<string>> {
  try {
    const rows = await query<{ code: string }>("SELECT code FROM courier_settings WHERE enabled = 0");
    return new Set(rows.map((r) => r.code));
  } catch (err) {
    console.error("[courier-settings] gagal membaca:", dbErrorMessage(err));
    return new Set();
  }
}

/** Semua kurir beserta status aktifnya (untuk halaman admin). */
export async function getCourierSettings(): Promise<
  { code: string; name: string; trackUrl: string | null; inRates: boolean; enabled: boolean }[]
> {
  const disabled = await getDisabledCourierCodes();
  return COURIERS.filter((c) => c.code !== OTHER_COURIER_CODE).map((c) => ({
    code: c.code,
    name: c.name,
    trackUrl: c.trackUrl,
    inRates: c.apiCode !== null,
    enabled: !disabled.has(c.code),
  }));
}

export async function setCourierEnabled(code: string, enabled: boolean): Promise<void> {
  await execute(
    `INSERT INTO courier_settings (code, enabled, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`,
    [code, enabled ? 1 : 0, new Date().toISOString()]
  );
}

/**
 * Apakah `courier_code` api.co.id boleh tampil di estimasi ongkir. Kurir yang belum
 * dikenal lib/couriers.mjs (baru ditambahkan api.co.id) tetap tampil — tidak bisa
 * diatur sampai ditambahkan ke daftar.
 */
export function isApiCourierAllowed(apiCode: string, disabled: Set<string>): boolean {
  const local = findCourierByApiCode(apiCode);
  return !local || !disabled.has(local.code);
}
