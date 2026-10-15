-- ===========================================================================
-- Skill 22: kurir & nomor resi pesanan (lacak pengiriman).
-- Jalur cadangan (22.1–22.3): admin mengisi kurir + resi, pelanggan melihat resi
-- dan tautan ke halaman lacak resmi kurir. tracking_summary/tracking_checked_at
-- disiapkan untuk integrasi api.co.id (22.4) setelah verifikasi 22.0.
-- Semua kolom nullable: pesanan lama/pickup tidak terpengaruh.
-- ===========================================================================
ALTER TABLE orders ADD COLUMN courier_code TEXT;           -- kode di lib/couriers.mjs
ALTER TABLE orders ADD COLUMN waybill TEXT;                -- nomor resi (A-Z, 0-9, "-")
ALTER TABLE orders ADD COLUMN shipped_at TEXT;             -- ISO-8601 UTC, saat resi pertama disimpan
ALTER TABLE orders ADD COLUMN tracking_summary TEXT;       -- JSON ternormalisasi (22.4), bukan payload mentah
ALTER TABLE orders ADD COLUMN tracking_checked_at TEXT;    -- ISO-8601 UTC (cache 30 menit, 22.4)
CREATE INDEX idx_orders_waybill ON orders (waybill);
