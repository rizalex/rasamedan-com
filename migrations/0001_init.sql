-- ===========================================================================
-- Rasa Medan - Skema awal D1 / SQLite (Skill 24)
-- Padanan dialek SQLite dari skema MySQL lama (docs/legacy/schema-mysql.sql).
--
-- Terapkan:  npm run db:migrate          (D1 lokal, untuk `next dev` & preview)
--            npm run db:migrate:remote   (D1 production — hati-hati)
--
-- Catatan konversi:
-- - ENUM → TEXT + CHECK; TINYINT(1) → INTEGER 0/1 + CHECK; UNSIGNED → CHECK >= 0.
-- - Waktu disimpan sebagai teks ISO-8601 UTC (`2026-10-14T03:00:00Z`) agar bisa
--   di-parse langsung oleh `new Date()` dan urut benar sebagai string.
--   Tampilan dikonversi ke WIB di lib/format.ts.
-- - Kolom yang di MySQL dibandingkan tanpa beda huruf besar/kecil (collation
--   utf8mb4_general_ci) diberi COLLATE NOCASE agar perilakunya sama: username,
--   slug, kategori, order_code, dan nama (urutan katalog).
-- - FK ditegakkan D1 secara default (ON DELETE CASCADE / SET NULL tetap berlaku).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- categories : kategori produk dinamis (Skill 14). `products.category` menyimpan
-- `slug` kategori — divalidasi di level aplikasi (tanpa FK, sama seperti MySQL).
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL COLLATE NOCASE,
  slug        TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Kategori awal (Skill 14). Wajib ada: admin hanya bisa menyimpan produk dengan
-- kategori yang terdaftar di tabel ini.
INSERT OR IGNORE INTO categories (name, slug) VALUES
  ('Kue', 'kue'),
  ('Kering', 'kering'),
  ('Sirup', 'sirup');

-- ---------------------------------------------------------------------------
-- products : katalog produk (1 foto utama per produk di MVP)
-- ---------------------------------------------------------------------------
CREATE TABLE products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT    NOT NULL COLLATE NOCASE UNIQUE,
  name          TEXT    NOT NULL COLLATE NOCASE,
  category      TEXT    NOT NULL COLLATE NOCASE,          -- slug kategori
  price         INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),  -- Rupiah (integer)
  weight_grams  INTEGER NOT NULL DEFAULT 0 CHECK (weight_grams >= 0), -- Skill 13
  stock_status  TEXT    NOT NULL DEFAULT 'tersedia'
                CHECK (stock_status IN ('tersedia', 'terbatas', 'pre-order', 'tanya-stok')),
  is_halal      INTEGER NOT NULL DEFAULT 1 CHECK (is_halal IN (0, 1)),
  description   TEXT,                                     -- Bahasa Indonesia (scope MVP)
  ingredients   TEXT,
  image         TEXT,                                     -- path foto, mis. /uploads/xxx.jpg
  is_featured   INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX idx_products_category ON products (category);
CREATE INDEX idx_products_stock_status ON products (stock_status);

-- Padanan `ON UPDATE CURRENT_TIMESTAMP` MySQL. WHEN mencegah trigger memicu
-- dirinya sendiri, dan menghormati updated_at yang di-set eksplisit.
CREATE TRIGGER trg_products_updated_at
AFTER UPDATE ON products
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE products SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id;
END;

-- ---------------------------------------------------------------------------
-- product_variants : variasi produk (rasa/ukuran), relasi 1-ke-banyak
-- ---------------------------------------------------------------------------
CREATE TABLE product_variants (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id   INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,                          -- mis. "Coklat", "Botol 620ml"
  price_delta  INTEGER NOT NULL DEFAULT 0,                -- selisih harga (0 = sama)
  weight_grams INTEGER NOT NULL DEFAULT 0 CHECK (weight_grams >= 0), -- 0 = ikut produk
  position     INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0)      -- urutan tampil
);
CREATE INDEX idx_variants_product ON product_variants (product_id);

-- ---------------------------------------------------------------------------
-- orders : pesanan pelanggan (tanpa akun). Order ID: ORD-YYYYMMDD-XXXX
-- CHECK status mengunci daftar baku PRD 2.1 (aturan bisnis #5 CLAUDE.md).
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  order_code         TEXT    NOT NULL COLLATE NOCASE UNIQUE,   -- ORD-YYYYMMDD-XXXX
  recipient_name     TEXT    NOT NULL,
  phone              TEXT    NOT NULL,
  fulfillment_method TEXT    NOT NULL CHECK (fulfillment_method IN ('kurir', 'pickup')),
  address            TEXT,                                     -- wajib untuk kurir
  city               TEXT,                                     -- kota/kecamatan
  location_note      TEXT,
  status             TEXT    NOT NULL DEFAULT 'Menunggu Konfirmasi'
                     CHECK (status IN (
                       'Menunggu Konfirmasi',
                       'Stok Dikonfirmasi',
                       'Menunggu Pembayaran',
                       'Pembayaran Diverifikasi',
                       'Dikemas',
                       'Dikirim',
                       'Siap Diambil',
                       'Selesai',
                       'Dibatalkan'
                     )),
  total_estimate     INTEGER CHECK (total_estimate >= 0),      -- estimasi total item (tanpa ongkir)
  note               TEXT,
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX idx_orders_phone ON orders (phone);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_created_at ON orders (created_at);

CREATE TRIGGER trg_orders_updated_at
AFTER UPDATE ON orders
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE orders SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id;
END;

-- ---------------------------------------------------------------------------
-- order_items : baris item per pesanan (snapshot nama & harga saat pesan)
-- ---------------------------------------------------------------------------
CREATE TABLE order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products (id) ON DELETE SET NULL, -- NULL bila produk dihapus
  product_name TEXT    NOT NULL,                         -- snapshot nama produk
  variant      TEXT,                                     -- variasi yang dipilih
  quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_price   INTEGER NOT NULL DEFAULT 0 CHECK (unit_price >= 0) -- Rupiah saat pesan
);
CREATE INDEX idx_items_order ON order_items (order_id);
CREATE INDEX idx_items_product ON order_items (product_id);

-- ---------------------------------------------------------------------------
-- admin_users : akun admin (password di-hash). Bukan pelanggan.
-- ---------------------------------------------------------------------------
CREATE TABLE admin_users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  username        TEXT    NOT NULL COLLATE NOCASE UNIQUE,
  password_hash   TEXT    NOT NULL,
  -- Naik saat ganti password → sesi lama di semua perangkat gugur (Skill 21.2 no. 5).
  session_version INTEGER NOT NULL DEFAULT 0 CHECK (session_version >= 0),
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ---------------------------------------------------------------------------
-- login_failures : catatan percobaan untuk rate limit yang tahan restart
-- (dipakai Skill 28; saat ini rate limit masih in-memory di lib/rate-limit.ts).
-- `bucket` = kunci rate limit, mis. "login:<ip>" / "checkorder:<ip>";
-- `ts` = epoch milidetik.
-- ---------------------------------------------------------------------------
CREATE TABLE login_failures (
  bucket TEXT    NOT NULL,
  ts     INTEGER NOT NULL
);
CREATE INDEX idx_login_failures_bucket_ts ON login_failures (bucket, ts);
