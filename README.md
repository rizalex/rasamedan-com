# Rasa Medan — Oleh-Oleh Khas Medan

Website katalog + pemesanan untuk UMKM oleh-oleh khas Medan. Pelanggan browsing & checkout **tanpa akun/login**; transaksi diselesaikan manual via WhatsApp. Admin mengelola produk, kategori, dan status pesanan via dashboard.

> Source of truth requirement: `PRD-Rasa-Medan_Toko-Oleh-Oleh-Medan.md`
> Panduan agent: `CLAUDE.md` · Modul kerja: `SKILLS.md` + `SKILLS-ADDENDUM.md` · Deploy: `DEPLOYMENT.md`

## 1. Cara Kerja (Business Flow)

```
1. Pelanggan browsing katalog (tanpa login)
2. Tambah ke keranjang (localStorage)
3. Checkout → kurir (nama, alamat, kota, catatan, HP) / pickup (nama, HP)
4. Sistem generate Order ID unik ORD-YYYYMMDD-XXXX, simpan ke MySQL (Menunggu Konfirmasi)
5. Buka wa.me dengan pesan otomatis (Order ID, item + variasi + qty + berat, metode, data pelanggan)
6-11. Manual via WA: cek stok → total + ongkir → QR/transfer → verifikasi
12-15. Admin update status → pelanggan cek di /cek-pesanan via no HP
```

Status baku (`orders.status`, ENUM di DB — jangan ubah tanpa update PRD §2.1):
`Menunggu Konfirmasi`, `Stok Dikonfirmasi`, `Menunggu Pembayaran`, `Pembayaran Diverifikasi`, `Dikemas`, `Dikirim`, `Siap Diambil`, `Selesai`, `Dibatalkan`

Aturan kritis: tanpa akun pelanggan, tanpa payment gateway, tanpa hitung ongkir otomatis, Order ID wajib unik, nomor WA hanya dari `.env` (`NEXT_PUBLIC_WA_NUMBER`).

## 2. Tech Stack

| Layer | Pilihan |
|---|---|
| Framework | Next.js 15 (App Router) + React 19, TypeScript |
| Styling | CSS murni / CSS Modules, mobile-first, CSS variables |
| DB | MySQL via `mysql2/promise` pool (`lib/db.ts`), parameterized query |
| Auth admin | Session cookie HttpOnly ber-HMAC-SHA256 (`lib/auth.ts`, `node:crypto` scrypt, 8 jam), reCAPTCHA v2 + rate-limit 5 gagal/15 mnt |
| i18n | `I18nProvider` + `locales/id.json`, `locales/en.json` (default `id`; nama/deskripsi produk tetap id) |
| WA | `lib/whatsapp.ts` → `https://wa.me/<nomor>?text=<encoded>` |
| SEO | `lib/seo.ts` (canonical, OG/Twitter, hreflang id/en, JSON-LD Product/LocalBusiness/Breadcrumb), `app/sitemap.ts`, `app/robots.ts` |
| Deploy | cPanel + Passenger, `server.js` sebagai startup file, `next start` standar, `images.unoptimized: true` (tanpa `sharp`) |

Palet (`:root`): `--color-primary #14432E`, `--color-secondary #1E5631`, `--color-accent #D4AF37`, `--color-bg #FFF8F0`, `--color-text #2B2B2B`. Merah marun sudah dihapus.

## 3. Struktur Proyek (aktual)

```
app/
  layout.tsx, page.tsx (beranda), not-found.tsx, sitemap.ts, robots.ts
  produk/page.tsx (katalog + filter/search) · produk/[slug]/page.tsx (detail)
  keranjang/page.tsx · checkout/page.tsx · cek-pesanan/page.tsx
  tentang/page.tsx · kontak/page.tsx
  admin/login/page.tsx
  admin/(protected)/layout.tsx · page.tsx (dashboard)
    produk/page.tsx · produk/baru/page.tsx · produk/[id]/edit/page.tsx
    pesanan/page.tsx · kategori/page.tsx · pengaturan/page.tsx
  api/
    orders/route.ts (public: buat order + lookup by HP)
    admin/auth/route.ts · admin/account/route.ts
    admin/products/route.ts · admin/products/[id]/route.ts
    admin/categories/route.ts · admin/categories/[id]/route.ts
    admin/orders/[id]/route.ts · admin/upload/route.ts
components/
  layout/Header, Footer · ui/icons · i18n/I18nProvider
  home/HomeView, TrustSection, StoreLocation
  catalog/CatalogView · product/ProductCard, ProductDetail, StockBadge
  cart/CartProvider, CartView · checkout/CheckoutView
  order/CheckOrderView, StatusBadge · support/AboutView, ContactView
  admin/AdminNav, ProductForm, CategoryManager, OrderStatusSelect, LoginForm, AccountSettingsForm
  seo/JsonLd
lib/ db, products, product-admin, categories, orders, orders-db,
     auth, rate-limit, recaptcha, whatsapp, store, seo, format, slug, i18n
db/schema.sql · data/dummy-products.json · data/site-info.json
locales/id.json · locales/en.json
public/uploads/ (foto produk, writable) · public/images/ (logo, hero, ornamen)
scripts/ test-db, apply-schema, seed, seed-categories, seed-admin,
         migrate-add-weight, repair-order-items
server.js · next.config.mjs · tsconfig.json
```

## 4. Database (MySQL)

`db/schema.sql` membuat 6 tabel: `categories`, `products`, `product_variants`, `orders`, `order_items`, `admin_users`.

- `products`: slug unik, category (slug string, divalidasi ke `categories`), price (Rp integer), `weight_grams` (Skill 13), `stock_status` (`tersedia|terbatas|pre-order|tanya-stok`), `is_halal`, `image` (`/uploads/...`), `is_featured`
- `product_variants`: `product_id` FK cascade, `price_delta`, `weight_grams` (0 = fallback ke produk), `position`
- `orders`: `order_code` unik, `phone` terindeks, `fulfillment_method` (`kurir|pickup`), `status` ENUM 9 nilai, `total_estimate` (tanpa ongkir)
- `order_items`: snapshot `product_name` + `unit_price` saat pesan (tahan hapus produk), FK order cascade / produk set-null
- `categories`: `slug` unik; hapus ditolak bila masih dipakai produk (cek level aplikasi)
- `admin_users`: `username` unik, `password_hash` format `salt:hash` (scrypt)

## 5. Setup Lokal

```bash
npm install
cp .env.example .env   # isi kredensial (jangan commit .env)
npm run db:test        # tes koneksi MySQL
npm run db:schema      # import schema
npm run seed           # 9 produk dummy
npm run seed:categories
ADMIN_USERNAME=admin ADMIN_PASSWORD=<kuat> npm run seed:admin
npm run dev            # http://localhost:3000
```

Build/prod check (wajib lolos sebelum deploy cPanel): `npm run build && npm start`

## 6. Environment Variables

| Var | Keterangan |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` | MySQL |
| `NEXT_PUBLIC_WA_NUMBER` | WA utama pemesanan, tanpa `+` (dev: dummy `62812...`) |
| `NEXT_PUBLIC_WA_NUMBER_ALT` | WA alternatif layanan umum (opsional) |
| `ADMIN_SESSION_SECRET` | Secret HMAC sesi (acak panjang) |
| `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY` | reCAPTCHA v2; kosong = login tanpa captcha |
| `NEXT_PUBLIC_SITE_URL` | Canonical/OG/sitemap (wajib domain asli saat live, tanpa trailing slash) |
| `NEXT_PUBLIC_STORE_NAME/ADDRESS/MAPS_EMBED_URL/MAPS_LINK_URL/STORE_HOURS_WEEKDAY/WEEKEND/IG_URL/TIKTOK_URL/FB_URL` | Lokasi toko & kontak (Skill 18) |
| `GOOGLE_SITE_VERIFICATION` | Token Search Console (opsional) |
| `NODE_ENV=production` | Di server |

## 7. Alur Fitur Penting

- **Katalog**: filter kategori dinamis dari `categories` + search client-side; badge stok 4 kondisi.
- **Detail**: variasi (chip/dropdown, `price_delta` terbawa ke cart); status `tanya-stok` → tombol WA langsung berisi nama produk.
- **Cart**: `CartProvider` + `localStorage`, persist saat refresh, subtotal otomatis.
- **Checkout**: validasi form per metode, hitung `total_berat = Σ berat×qty`, simpan order + items dulu, baru redirect `wa.me`.
- **Cek pesanan**: cari by no HP (+ opsional Order ID), parameterized query, hanya data HP tsb.
- **Admin**: route `(protected)` redirect ke `/admin/login` bila tanpa sesi; CRUD produk + upload 1 foto (`/public/uploads`, validasi tipe/ukuran); kelola pesanan + ubah status (langsung terlihat di cek-pesanan); kelola kategori; pengaturan akun (wajib password saat ini, ganti password → logout paksa).
- **SEO**: title/desc unik per halaman, `next/image` + `alt` deskriptif, satu `h1` per halaman, cart/checkout `noindex`, robots blokir `/admin /api /checkout /keranjang /cek-pesanan`.

## 8. Deploy (ringkas)

Lihat `DEPLOYMENT.md`. Intinya: buat DB + import `db/schema.sql` via phpMyAdmin, isi env di panel Node.js App, startup file `server.js`, Node 18+, aktifkan SSL (wajib untuk cookie `secure`), pastikan `public/uploads` writable, kerjakan checklist go-live (ganti WA dummy, secret, password admin, tes checkout → WA → cek status → admin login).

## 9. Peta Dokumen

- `PRD-Rasa-Medan_Toko-Oleh-Oleh-Medan.md` — requirement & roadmap
- `CLAUDE.md` — aturan agent/tech stack/aturan bisnis/DoD
- `SKILLS.md` (Skill 1–12 MVP) + `SKILLS-ADDENDUM.md` (Skill 13–19: berat, kategori, reCAPTCHA, pengaturan, redesign, lokasi, SEO)
- `DEPLOYMENT.md` — panduan cPanel langkah-demi-langkah
