-- ===========================================================================
-- Skill 31: estimasi ongkir mandiri di checkout (api.co.id).
-- shipping_cache: hasil api.co.id yang sudah DINORMALISASI (bukan payload mentah).
--   Kunci: 'loc:province', 'loc:city:<prov>', 'loc:district:<city>',
--          'rate:<asal>:<tujuan>:<berat_gram_bucket>', 'circuit:rates'.
-- Kolom orders.shipping_*: snapshot estimasi pilihan pelanggan. Semua nullable:
-- pesanan lama, pickup, dan fallback "dikonfirmasi via WhatsApp" tetap NULL.
-- total_estimate TETAP = total item saja (ongkir di kolom terpisah).
-- ===========================================================================
CREATE TABLE shipping_cache (
  cache_key  TEXT PRIMARY KEY,
  payload    TEXT NOT NULL,   -- JSON ternormalisasi
  fetched_at TEXT NOT NULL,   -- ISO-8601 UTC
  expires_at TEXT NOT NULL    -- ISO-8601 UTC
);
CREATE INDEX idx_shipping_cache_expires ON shipping_cache (expires_at);

ALTER TABLE orders ADD COLUMN shipping_district_code TEXT;   -- kode kecamatan api.co.id
ALTER TABLE orders ADD COLUMN shipping_courier TEXT;         -- courier_code api.co.id (pilihan pelanggan)
ALTER TABLE orders ADD COLUMN shipping_service TEXT;         -- label snapshot, mis. "JNE Express · REG23"
ALTER TABLE orders ADD COLUMN shipping_etd TEXT;             -- estimasi hari snapshot, mis. "2-4"
ALTER TABLE orders ADD COLUMN shipping_estimate INTEGER;     -- Rupiah, sudah dibulatkan ke atas Rp 1.000
ALTER TABLE orders ADD COLUMN shipping_weight_grams INTEGER; -- bucket berat (ceil 100 g) yang dikutip
ALTER TABLE orders ADD COLUMN shipping_quoted_at TEXT;       -- fetched_at cache tarif yang dipakai
