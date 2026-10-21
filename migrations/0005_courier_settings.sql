-- ===========================================================================
-- Skill 32: pengaturan kurir agen yang dipakai toko (admin → Kurir).
-- Satu baris per kode kurir lib/couriers.mjs. Tidak ada baris = AKTIF (default
-- semua kurir aktif, sesuai keputusan pemilik 31a). Kurir nonaktif tidak muncul di
-- estimasi ongkir checkout dan daftar kurir resi admin.
-- ===========================================================================
CREATE TABLE courier_settings (
  code       TEXT PRIMARY KEY,           -- kode di lib/couriers.mjs, mis. "jne"
  enabled    INTEGER NOT NULL DEFAULT 1, -- 1 = aktif, 0 = nonaktif
  updated_at TEXT NOT NULL               -- ISO-8601 UTC
);
