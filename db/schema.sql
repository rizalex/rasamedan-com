-- ===========================================================================
-- Rasa Medan - Schema Database (MySQL)
-- Mengikuti PRD bagian 5.2 & daftar tabel SKILLS.md Skill 1:
--   products, product_variants, orders, order_items, admin_users
--
-- Cara pakai (lokal):   npm run db:schema      (butuh `.env` sudah diisi)
-- Cara pakai (cPanel):  import file ini via phpMyAdmin -> tab Import
--
-- Nama kolom memakai bahasa Inggris snake_case (konvensi kode, AGENTS.md bag.4)
-- dan diselaraskan dengan field di `data/dummy-products.json`.
-- ===========================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- categories : kategori produk dinamis (dikelola admin, Skill 14).
-- `products.category` menyimpan `slug` kategori (string) — divalidasi terhadap
-- tabel ini di level aplikasi (pendekatan aman tanpa migrasi FK berat).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- products : katalog produk (1 foto utama per produk di MVP)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug          VARCHAR(191) NOT NULL,
  name          VARCHAR(191) NOT NULL,
  category      VARCHAR(50)  NOT NULL,               -- kue | kering | sirup | dll
  price         INT UNSIGNED NOT NULL DEFAULT 0,     -- harga dalam Rupiah (integer)
  weight_grams  INT UNSIGNED NOT NULL DEFAULT 0,     -- berat satuan dalam gram (Skill 13)
  stock_status  ENUM('tersedia','terbatas','pre-order','tanya-stok')
                NOT NULL DEFAULT 'tersedia',
  is_halal      TINYINT(1)   NOT NULL DEFAULT 1,
  description   TEXT         NULL,                    -- Bahasa Indonesia (scope MVP)
  ingredients   TEXT         NULL,
  image         VARCHAR(255) NULL,                    -- path foto, mis. /uploads/xxx.jpg
  is_featured   TINYINT(1)   NOT NULL DEFAULT 0,      -- produk pilihan di beranda
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_slug (slug),
  KEY idx_products_category (category),
  KEY idx_products_stock_status (stock_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- product_variants : variasi produk (rasa/ukuran), relasi 1-ke-banyak
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_variants (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id  INT UNSIGNED NOT NULL,
  name        VARCHAR(100) NOT NULL,                 -- mis. "Coklat", "Botol 620ml"
  price_delta INT NOT NULL DEFAULT 0,                -- selisih harga (0 = sama)
  weight_grams INT UNSIGNED NOT NULL DEFAULT 0,      -- berat varian (0 = pakai berat produk utama, Skill 13)
  position    INT UNSIGNED NOT NULL DEFAULT 0,       -- urutan tampil
  PRIMARY KEY (id),
  KEY idx_variants_product (product_id),
  CONSTRAINT fk_variants_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- orders : pesanan pelanggan (tanpa akun). Order ID: ORD-YYYYMMDD-XXXX
-- status ENUM mengunci daftar baku PRD 2.1 (aturan bisnis #5 AGENTS.md).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_code         VARCHAR(20)  NOT NULL,          -- ORD-YYYYMMDD-XXXX
  recipient_name     VARCHAR(191) NOT NULL,
  phone              VARCHAR(30)  NOT NULL,
  fulfillment_method ENUM('kurir','pickup') NOT NULL,
  address            TEXT         NULL,              -- wajib untuk kurir, kosong utk pickup
  city               VARCHAR(120) NULL,              -- kota/kecamatan
  location_note      TEXT         NULL,              -- catatan lokasi
  status             ENUM(
                       'Menunggu Konfirmasi',
                       'Stok Dikonfirmasi',
                       'Menunggu Pembayaran',
                       'Pembayaran Diverifikasi',
                       'Dikemas',
                       'Dikirim',
                       'Siap Diambil',
                       'Selesai',
                       'Dibatalkan'
                     ) NOT NULL DEFAULT 'Menunggu Konfirmasi',
  total_estimate     INT UNSIGNED NULL,              -- estimasi total item (tanpa ongkir)
  note               TEXT         NULL,
  created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_code (order_code),
  KEY idx_orders_phone (phone),
  KEY idx_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- order_items : baris item per pesanan (snapshot nama & harga saat pesan)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id     INT UNSIGNED NOT NULL,
  product_id   INT UNSIGNED NULL,                    -- SET NULL bila produk dihapus
  product_name VARCHAR(191) NOT NULL,                -- snapshot nama produk
  variant      VARCHAR(100) NULL,                    -- variasi yang dipilih
  quantity     INT UNSIGNED NOT NULL DEFAULT 1,
  unit_price   INT UNSIGNED NOT NULL DEFAULT 0,      -- harga satuan saat pesan (Rupiah)
  PRIMARY KEY (id),
  KEY idx_items_order (order_id),
  KEY idx_items_product (product_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id)
    REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- admin_users : akun admin (password di-hash, mis. bcryptjs). Bukan pelanggan.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(50)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 1;
