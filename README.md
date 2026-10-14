# Rasa Medan — Oleh-Oleh Khas Medan

> ⚠️ **Status (Skill 23, 13 Okt 2026):** aplikasi sedang dimigrasi ke Cloudflare Workers. `server.js` sudah dihapus dari `main`, jadi bagian deploy & `server.js` untuk cPanel di bawah **tidak lagi berlaku untuk `main`**. Hotfix cPanel darurat: checkout commit `fb4ea12`. Dokumen ini ditulis ulang untuk Cloudflare di Skill 29.

Website katalog + pemesanan untuk UMKM oleh-oleh khas Medan. Pelanggan browsing & checkout **tanpa akun/login**; transaksi diselesaikan manual via WhatsApp. Admin mengelola produk, kategori, dan status pesanan via dashboard.

> Source of truth requirement: `PRD-Rasa-Medan_Toko-Oleh-Oleh-Medan.md`
> Panduan agent: `CLAUDE.md` · Modul kerja: `SKILLS.md` (Skill 1–30) · Deploy: `DEPLOYMENT.md`

## 1. Cara Kerja (Business Flow)

```
1. Pelanggan browsing katalog (tanpa login)
2. Tambah ke keranjang (localStorage)
3. Checkout → kurir (nama, alamat, kota, catatan, HP) / pickup (nama, HP)
4. Sistem generate Order ID unik ORD-YYYYMMDD-XXXX, simpan ke database (Menunggu Konfirmasi)
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
| DB | Cloudflare D1 (SQLite) via binding `DB` (`lib/db.ts`: `query`/`queryIn`/`execute`/`batch`), parameterized query; skema di `migrations/` |
| Auth admin | Session cookie HttpOnly ber-HMAC-SHA256 (`lib/auth.ts`, Web Crypto `crypto.subtle`, 8 jam); password PBKDF2-SHA256 30.000 iterasi (`lib/password.mjs`, min. 12 karakter), sesi dicabut via `session_version` saat ganti password; Cloudflare Turnstile (login, cek pesanan, checkout; fail-closed di production) + rate limit di tabel D1 `login_failures` (login 5 gagal/15 mnt, cek pesanan, checkout 10/jam, Pengaturan; tahan restart, atomik); header keamanan + CSP (`next.config.mjs`) |
| i18n | `I18nProvider` + `locales/id.json`, `locales/en.json` (default `id`; nama/deskripsi produk tetap id) |
| WA | `lib/whatsapp.ts` → `https://wa.me/<nomor>?text=<encoded>` |
| SEO | `lib/seo.ts` (canonical, OG/Twitter, hreflang id/en, JSON-LD Product/LocalBusiness/Breadcrumb), `app/sitemap.ts`, `app/robots.ts` |
| Deploy | Cloudflare Workers via `@opennextjs/cloudflare` (`npm run preview` / `npm run deploy`), `images.unoptimized: true` (tanpa `sharp`). Production lama masih cPanel sampai cutover Skill 30 |

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
     auth, rate-limit, turnstile, client-ip, image-type, pricing, phone, whatsapp, store, seo, format, slug, i18n
migrations/0001_init.sql · data/dummy-products.json · data/site-info.json
locales/id.json · locales/en.json
public/images/ (logo, hero, ornamen) · foto produk di R2 (`lib/uploads.ts`, disajikan `app/uploads/[...path]/route.ts`)
scripts/ seed, seed-admin (lib/d1.mjs), check-deploy-env, strip-bundle-secrets
docs/legacy/schema-mysql.sql (arsip skema MySQL lama)
wrangler.jsonc · open-next.config.ts · cloudflare-env.d.ts · next.config.mjs · tsconfig.json
```

## 4. Database (Cloudflare D1)

`migrations/0001_init.sql` (dialek SQLite) membuat 6 tabel: `categories` (berisi Kue/Kering/Sirup), `products`, `product_variants`, `orders`, `order_items`, `admin_users` — plus `login_failures` (rate limit, Skill 28). Perubahan skema = file migrasi baru `migrations/NNNN_*.sql`; jangan mengedit migrasi yang sudah diterapkan.

Catatan D1: waktu disimpan sebagai teks ISO-8601 UTC (ditampilkan WIB); kolom username/slug/kategori/`order_code` memakai `COLLATE NOCASE` (tidak peka huruf besar/kecil, sama seperti MySQL dulu); maks 100 parameter per query (`queryIn` memecah `IN` panjang); transaksi = `batch()` (D1 tidak mendukung BEGIN/COMMIT).

- `products`: slug unik, category (slug string, divalidasi ke `categories`), price (Rp integer), `weight_grams` (Skill 13), `stock_status` (`tersedia|terbatas|pre-order|tanya-stok`), `is_halal`, `image` (`/uploads/...`), `is_featured`
- `product_variants`: `product_id` FK cascade, `price_delta` (harga varian = harga produk + selisih, boleh minus), `weight_grams` (0 = fallback ke produk), `position` — semuanya diisi lewat editor varian di form admin
- `orders`: `order_code` unik, `phone` terindeks, `fulfillment_method` (`kurir|pickup`), `status` CHECK 9 nilai baku, `total_estimate` (tanpa ongkir); order + items disimpan atomik dalam satu `batch()`
- `order_items`: snapshot `product_name` + `unit_price` saat pesan (tahan hapus produk), FK order cascade / produk set-null
- `categories`: `slug` unik; hapus ditolak bila masih dipakai produk (cek level aplikasi)
- `admin_users`: `username` unik, `password_hash` format `pbkdf2:iterasi:salt:hash` (hash scrypt lama ditolak — reset via `seed:admin -- --reset`)

## 5. Setup Lokal

```bash
npm install
cp .env.example .env   # isi nilai lokal (jangan commit .env)
npm run db:migrate     # buat tabel di D1 LOKAL (.wrangler/state), tanpa akun Cloudflare
npm run seed           # 9 produk dummy (tolak bila produk sudah ada; --force untuk timpa)
ADMIN_USERNAME=admin ADMIN_PASSWORD=<kuat> npm run seed:admin
npm run dev            # http://localhost:3000 (next dev memakai D1 lokal yang sama)
```

Seed alternatif tanpa Node: `npx wrangler d1 execute rasamedan --local --file db/seed/dummy-products.sql` (dibangkitkan `npm run seed:sql`; hanya mengganti produk dummy, aman diulang; otomatis gagal tanpa menghapus apa pun bila D1 berisi produk non-dummy).

**Migrasi data cPanel → D1 (Skill 25):** `npm i --no-save mysql2` → buka SSH tunnel ke cPanel (`ssh -L 3307:localhost:3306 …`) → `npm run db:export` (kredensial `DB_*` di `.env` dengan `DB_HOST=127.0.0.1`, `DB_PORT=3307`; hasil di `db-export/` — berisi data pribadi, di-gitignore) → `npm run db:import -- --file db-export/<file>.sql [--remote]` (menolak D1 yang sudah berisi; verifikasi jumlah baris, order_code unik, FK). Admin tidak ikut dimigrasi — buat ulang dengan `seed:admin`.

Semua perintah DB menuju D1 **lokal** secara default; target production wajib eksplisit: `npm run db:migrate:remote`, `npm run seed:admin -- --remote`. Reset DB lokal: hapus folder `.wrangler/state` lalu ulangi `db:migrate`.

Cek runtime Workers lokal: `npm run preview` (http://localhost:8787, memakai D1 + R2 lokal + `.dev.vars`).

**Foto produk (R2, Skill 27):** `next dev` dan preview menyimpan upload di R2 tiruan lokal (`.wrangler/state`, tanpa akun Cloudflare) — tidak ada lagi penulisan ke `public/uploads`. Memindahkan foto lama: `npm run uploads:r2 -- --dir <folder>` (lokal) / `-- --remote` (production); `--dry-run` untuk melihat daftar dulu. Hanya file JPG/PNG/WEBP/GIF (dicek magic bytes) bernama aman yang diunggah. Jangan menaruh foto di `public/uploads/`: di `next dev` file di sana menimpa route R2 (di build Workers diabaikan lewat `public/.assetsignore`) — `--dir` wajib dan harus di luar `public/` (skrip & `npm run deploy` menolak bila tidak). Bucket R2 harus tetap privat: jangan aktifkan r2.dev/public URL. Setelah mengubah `wrangler.jsonc` atau menambah secret di `.dev.vars.example`: `npm run cf:typegen`.

## 6. Environment Variables

| Var | Keterangan |
|---|---|
| `NEXT_PUBLIC_WA_NUMBER` | WA utama pemesanan, tanpa `+` (dev: dummy `62812...`) |
| `NEXT_PUBLIC_WA_NUMBER_ALT` | WA alternatif layanan umum (opsional) |
| `ADMIN_SESSION_SECRET` | Secret HMAC sesi (acak panjang) |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile. Dev: kosong = captcha dilewati (atau test key `1x…`). Production: wajib key asli — tanpa secret request ditolak; site key lewat `vars` wrangler, secret lewat `wrangler secret put` |
| `NEXT_PUBLIC_SITE_URL` | Canonical/OG/sitemap (wajib domain asli saat live, tanpa trailing slash) |
| `NEXT_PUBLIC_STORE_NAME/ADDRESS/MAPS_EMBED_URL/MAPS_LINK_URL/STORE_HOURS_WEEKDAY/WEEKEND/IG_URL/TIKTOK_URL/FB_URL` | Lokasi toko & kontak (Skill 18) |
| `GOOGLE_SITE_VERIFICATION` | Token Search Console (opsional) |
| `NODE_ENV=production` | Di server |

## 7. Alur Fitur Penting

- **Katalog**: filter kategori dinamis dari `categories` + search client-side; badge stok 4 kondisi.
- **Detail**: variasi (chip; harga & berat varian dipakai di keranjang, dihitung ulang server saat checkout — `lib/pricing.ts`); status `tanya-stok` → tombol WA langsung berisi nama produk.
- **Cart**: `CartProvider` + `localStorage`, persist saat refresh, subtotal otomatis.
- **Checkout**: validasi form per metode, hitung `total_berat = Σ berat×qty`, simpan order + items dulu, baru redirect `wa.me`.
- **Cek pesanan**: cari by no HP (+ opsional Order ID), parameterized query, hanya data HP tsb.
- **Admin**: route `(protected)` redirect ke `/admin/login` bila tanpa sesi; CRUD produk + upload 1 foto ke R2 (validasi magic bytes JPG/PNG/WEBP/GIF, maks 2 MB; URL tetap `/uploads/<nama>`, cache `immutable`); kelola pesanan + ubah status (langsung terlihat di cek-pesanan); kelola kategori; pengaturan akun (wajib password saat ini, ganti password → logout paksa).
- **SEO**: title/desc unik per halaman, `next/image` + `alt` deskriptif, satu `h1` per halaman, cart/checkout `noindex`, robots blokir `/admin /api /checkout /keranjang /cek-pesanan`.

## 8. Deploy (ringkas)

Target: Cloudflare Workers (migrasi Skill 23–30; panduan lengkap ditulis ulang di Skill 29). Urutan saat ini: `npx wrangler d1 create rasamedan` + `npx wrangler r2 bucket create rasa-medan-uploads` → salin `database_id` ke `wrangler.jsonc` → `npm run db:migrate:remote` → `npm run seed:admin -- --remote` → `npm run uploads:r2 -- --dir <foto cPanel> --remote` → isi `TURNSTILE_SITE_KEY` + secret (`wrangler secret put`) → `npm run deploy` (diblokir `scripts/check-deploy-env.mjs` bila konfigurasi belum lengkap). `DEPLOYMENT.md` masih versi cPanel (hanya untuk hotfix dari commit `fb4ea12`).

## 9. Peta Dokumen

- `PRD-Rasa-Medan_Toko-Oleh-Oleh-Medan.md` — requirement & roadmap
- `CLAUDE.md` — aturan agent/tech stack/aturan bisnis/DoD
- `SKILLS.md` — satu file berisi Skill 1–12 (MVP), 13–19 (berat, kategori, Turnstile, pengaturan, redesign, lokasi, SEO), 20–21 (code & security review), 22 (lacak pengiriman)
- `.claude/agents/` — subagent `architect`, `code-reviewer`, `security-auditor`
- `DEPLOYMENT.md` — panduan cPanel langkah-demi-langkah
