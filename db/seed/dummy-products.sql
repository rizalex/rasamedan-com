-- DIBANGKITKAN OTOMATIS oleh scripts/build-seed-sql.mjs dari data/dummy-products.json.
-- Jangan diedit manual — ubah JSON lalu jalankan: npm run seed:sql
-- Hanya untuk D1 LOKAL (bertanda _local_dev dari npm run db:migrate). Penjaga _seed_guard
-- membuat file ini GAGAL tanpa mengubah apa pun di D1 production (walau kosong) atau
-- D1 berisi produk non-dummy (mis. hasil impor data asli). Aman dijalankan ulang:
--   npx wrangler d1 execute rasamedan --local --file db/seed/dummy-products.sql
DROP TABLE IF EXISTS _seed_guard;
CREATE TABLE _seed_guard (violations INTEGER CHECK (violations = 0));
INSERT INTO _seed_guard SELECT
       (SELECT COUNT(*) FROM products WHERE slug NOT IN ('bolu-gulung-medan', 'bika-ambon-original', 'lapis-legit-medan', 'kacang-sihobuk', 'kripik-ubi-medan', 'sambal-teri-kacang', 'sirup-markisa-medan', 'sirup-jeruk-berastagi', 'sirup-jahe-merah'))
     + (1 - (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '_local_dev'));
DROP TABLE _seed_guard;
DELETE FROM products WHERE slug IN ('bolu-gulung-medan', 'bika-ambon-original', 'lapis-legit-medan', 'kacang-sihobuk', 'kripik-ubi-medan', 'sambal-teri-kacang', 'sirup-markisa-medan', 'sirup-jeruk-berastagi', 'sirup-jahe-merah');
INSERT INTO products (id, slug, name, category, price, weight_grams, stock_status, is_halal, is_featured, description, ingredients, image) VALUES (1, 'bolu-gulung-medan', 'Bolu Gulung Medan', 'kue', 45000, 400, 'tersedia', 1, 1, 'Bolu gulung lembut khas Medan dengan lapisan krim yang legit. Cocok untuk oleh-oleh keluarga.', 'Tepung terigu, telur, gula, mentega, susu, coklat/keju/pandan sesuai varian', '/images/products/bolu-gulung-medan.jpg');
INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (1, 'Coklat', 0, 0, 0);
INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (1, 'Keju', 0, 0, 1);
INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (1, 'Pandan', 0, 0, 2);
INSERT INTO products (id, slug, name, category, price, weight_grams, stock_status, is_halal, is_featured, description, ingredients, image) VALUES (2, 'bika-ambon-original', 'Bika Ambon Original', 'kue', 60000, 500, 'tersedia', 1, 1, 'Bika Ambon asli Medan dengan tekstur kenyal berongga dan aroma khas daun pandan/durian.', 'Tepung sagu, telur, santan, gula, ragi, daun pandan/durian sesuai varian', '/images/products/bika-ambon-original.jpg');
INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (2, 'Original', 0, 0, 0);
INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (2, 'Pandan', 0, 0, 1);
INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (2, 'Durian', 0, 0, 2);
INSERT INTO products (id, slug, name, category, price, weight_grams, stock_status, is_halal, is_featured, description, ingredients, image) VALUES (3, 'lapis-legit-medan', 'Lapis Legit Medan', 'kue', 120000, 700, 'terbatas', 1, 1, 'Kue lapis legit dengan puluhan lapisan tipis, dipanggang tradisional dengan rempah pilihan.', 'Tepung terigu, mentega, telur, gula, rempah-rempah (kayu manis, cengkeh)', '/images/products/lapis-legit-medan.jpg');
INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (3, 'Original', 0, 0, 0);
INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (3, 'Kismis', 0, 0, 1);
INSERT INTO products (id, slug, name, category, price, weight_grams, stock_status, is_halal, is_featured, description, ingredients, image) VALUES (4, 'kacang-sihobuk', 'Kacang Sihobuk', 'kering', 35000, 250, 'tersedia', 1, 0, 'Kacang tanah khas Tapanuli yang disangrai dengan pasir panas, renyah dan gurih.', 'Kacang tanah, garam, bumbu pedas (untuk varian pedas)', '/images/products/kacang-sihobuk.jpg');
INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (4, 'Original', 0, 0, 0);
INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (4, 'Pedas', 0, 0, 1);
INSERT INTO products (id, slug, name, category, price, weight_grams, stock_status, is_halal, is_featured, description, ingredients, image) VALUES (5, 'kripik-ubi-medan', 'Keripik Ubi Medan', 'kering', 25000, 200, 'tersedia', 1, 0, 'Keripik ubi renyah dengan pilihan rasa gurih, pedas balado, hingga keju.', 'Ubi jalar/singkong, minyak goreng, bumbu sesuai varian', '/images/products/kripik-ubi-medan.jpg');
INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (5, 'Original', 0, 0, 0);
INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (5, 'Balado', 0, 0, 1);
INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (5, 'Keju', 0, 0, 2);
INSERT INTO products (id, slug, name, category, price, weight_grams, stock_status, is_halal, is_featured, description, ingredients, image) VALUES (6, 'sambal-teri-kacang', 'Sambal Teri Kacang Kering', 'kering', 40000, 200, 'pre-order', 1, 0, 'Sambal kering teri kacang, tahan lama, cocok jadi teman nasi atau oleh-oleh.', 'Teri, kacang tanah, cabai, bawang, gula merah', '/images/products/sambal-teri-kacang.jpg');
INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (6, 'Pedas Sedang', 0, 0, 0);
INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (6, 'Pedas Extra', 0, 0, 1);
INSERT INTO products (id, slug, name, category, price, weight_grams, stock_status, is_halal, is_featured, description, ingredients, image) VALUES (7, 'sirup-markisa-medan', 'Sirup Markisa Medan', 'sirup', 30000, 900, 'tersedia', 1, 0, 'Sirup markisa asli dengan rasa asam manis segar, favorit khas Sumatera Utara.', 'Sari buah markisa, gula, air, pengawet makanan sesuai standar BPOM', '/images/products/sirup-markisa-medan.jpg');
INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (7, 'Botol 620ml', 0, 0, 0);
INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (7, 'Botol 1 Liter', 15000, 1300, 1);
INSERT INTO products (id, slug, name, category, price, weight_grams, stock_status, is_halal, is_featured, description, ingredients, image) VALUES (8, 'sirup-jeruk-berastagi', 'Sirup Jeruk Berastagi', 'sirup', 32000, 900, 'tersedia', 1, 0, 'Sirup dari jeruk khas Berastagi, segar dengan rasa asam manis alami.', 'Sari buah jeruk, gula, air, pengawet makanan sesuai standar BPOM', '/images/products/sirup-jeruk-berastagi.jpg');
INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (8, 'Botol 620ml', 0, 0, 0);
INSERT INTO products (id, slug, name, category, price, weight_grams, stock_status, is_halal, is_featured, description, ingredients, image) VALUES (9, 'sirup-jahe-merah', 'Sirup Jahe Merah', 'sirup', 33000, 900, 'tanya-stok', 1, 0, 'Sirup jahe merah hangat, cocok diminum saat cuaca dingin atau untuk daya tahan tubuh.', 'Ekstrak jahe merah, gula, air', '/images/products/sirup-jahe-merah.jpg');
INSERT INTO product_variants (product_id, name, price_delta, weight_grams, position) VALUES (9, 'Botol 620ml', 0, 0, 0);
