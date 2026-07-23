# SKILLS-ADDENDUM.md
## Fitur Tambahan Pasca-MVP (Skill 13-18)

Lanjutan dari `SKILLS.md`. Kerjakan berurutan, satu skill per sesi Claude Code, review dulu sebelum lanjut ke skill berikutnya.

---

## Skill 13 — Berat Produk & Info Ongkir Manual

**Tujuan:** Pemilik bisa lihat total berat pesanan langsung dari pesan WhatsApp otomatis, tanpa perlu tanya balik ke pelanggan atau hitung manual dari daftar barang.

**Perubahan Database:**
```sql
ALTER TABLE products ADD COLUMN weight_grams INT NOT NULL DEFAULT 0;
```
- Jika produk punya variasi dengan berat berbeda (misal ukuran botol beda), tambahkan kolom `weight_grams` di tabel `product_variants` juga, dan gunakan berat varian jika ada, fallback ke berat produk utama jika tidak.

**Perubahan Admin:**
- Tambahkan field "Berat (gram)" di form tambah/edit produk — wajib diisi, angka > 0.
- Tampilkan kolom berat di tabel daftar produk admin agar mudah dicek/diedit massal.

**Perubahan Checkout & WhatsApp:**
- Saat generate pesan WhatsApp otomatis, hitung: `total_berat = Σ (berat_produk × qty)` untuk semua item di pesanan.
- Tambahkan baris ini di template pesan WhatsApp, misal:
  ```
  Total berat pesanan: 850 gram
  ```
- (Opsional) Tampilkan total berat juga di halaman ringkasan sebelum checkout, agar pelanggan sudah punya gambaran.

**Acceptance Criteria:**
- [ ] Semua produk existing (dummy) sudah diisi berat wajar (bisa lewat seed/migration)
- [ ] Form admin menolak submit jika berat kosong/0
- [ ] Pesan WhatsApp otomatis menyertakan total berat pesanan yang benar (teruji dengan berbagai kombinasi produk & qty)

---

## Skill 14 — Manajemen Kategori Dinamis

**Tujuan:** Admin bisa tambah/edit/hapus kategori sendiri tanpa perlu ubah kode (saat ini "Kue/Kering/Sirup" masih hardcoded).

**Perubahan Database:**
```sql
CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
- Migrasi data: masukkan 3 kategori awal (Kue, Kering, Sirup) sebagai baris pertama di tabel ini (seed).
- Ubah kolom `category` di tabel `products` menjadi `category_id` (foreign key ke `categories.id`), atau jika ingin lebih aman tanpa migrasi berat, tetap simpan `category` sebagai string tapi validasi terhadap tabel `categories` di level aplikasi.

**Perubahan Admin:**
- Halaman baru: **Kelola Kategori** (`/admin/dashboard/kategori`) — list, tambah, edit nama, hapus.
- Validasi hapus kategori: cegah penghapusan jika masih ada produk yang memakainya (tampilkan pesan error, atau minta admin pindahkan dulu produk ke kategori lain).
- Form tambah/edit produk: dropdown kategori sekarang diambil dari tabel `categories`, bukan hardcoded array.

**Perubahan Frontend (Katalog):**
- Filter kategori di halaman katalog dirender dinamis dari data `categories`, bukan hardcoded 3 chip.

> **Catatan dari mockup terbaru:** Referensi desain menampilkan beberapa kategori (Kue, Camilan, Sirup, Cookies, Oleh-oleh Khas Medan) — lebih banyak dari asumsi awal (3). Karena kategori sudah dinamis di skill ini, admin tinggal menambahkannya sendiri lewat halaman Kelola Kategori, TIDAK perlu perubahan kode tambahan untuk menambah kategori baru.
>
> Kategori **"Produk Terbatas"** yang muncul di mockup **diabaikan/tidak perlu dibuat** — bukan bagian dari scope.

**Acceptance Criteria:**
- [ ] Admin bisa tambah kategori baru dan langsung muncul sebagai filter di katalog tanpa perlu deploy ulang
- [ ] Tidak bisa hapus kategori yang masih dipakai produk
- [ ] Kategori awal (Kue/Kering/Sirup) tetap ada setelah migrasi, produk lama tidak "hilang" kategorinya

---

## Skill 15 — Keamanan Tambahan pada Admin Login

**Tujuan:** Menambah lapisan keamanan di form login admin dengan Google reCAPTCHA, plus beberapa hardening dasar.

### 15.1 Google reCAPTCHA
**Rekomendasi: reCAPTCHA v2 ("I'm not a robot" checkbox)** — lebih sederhana diimplementasi dan cukup untuk MVP dibanding v3 yang butuh logika scoring tambahan.

**Langkah setup (dilakukan Anda sendiri dulu, bukan Claude Code):**
1. Buka https://www.google.com/recaptcha/admin
2. Daftarkan situs, pilih reCAPTCHA v2 checkbox, masukkan domain Anda (dan `localhost` untuk testing).
3. Simpan **Site Key** dan **Secret Key** yang diberikan.

**Tambahan di `.env`:**
```
RECAPTCHA_SITE_KEY=your_site_key
RECAPTCHA_SECRET_KEY=your_secret_key
```

**Yang perlu Claude Code kerjakan:**
- Frontend: render widget reCAPTCHA di halaman `/admin/login` menggunakan `RECAPTCHA_SITE_KEY` (via script Google resmi atau library seperti `react-google-recaptcha`).
- Backend: sebelum memvalidasi username/password, verifikasi token reCAPTCHA dari client dengan POST ke:
  ```
  https://www.google.com/recaptcha/api/siteverify
  ```
  menyertakan `secret` dan `response` (token dari client). Jika verifikasi gagal, tolak login dengan pesan error, JANGAN lanjut cek password.

### 15.2 Hardening Tambahan (disarankan, tidak wajib tapi sangat dianjurkan)
- **Rate limiting**: batasi percobaan login (misal maksimal 5x gagal dalam 15 menit per IP/username), lalu kunci sementara.
- **Password hashing**: pastikan password admin di database disimpan sebagai hash (`bcrypt`/`argon2`), BUKAN plain text — jika belum, ini prioritas tinggi untuk diperbaiki dulu sebelum tambah reCAPTCHA.
- **Cookie session aman**: pastikan cookie session admin memakai flag `httpOnly`, `secure` (khusus HTTPS), dan `sameSite=strict`.
- **HTTPS wajib** di production — pastikan SSL aktif di cPanel (lihat `DEPLOYMENT.md`).

**Acceptance Criteria:**
- [ ] Login admin tanpa mengisi/centang reCAPTCHA ditolak
- [ ] Token reCAPTCHA diverifikasi di server (bukan hanya validasi di client)
- [ ] Password admin di database sudah dalam bentuk hash
- [ ] Setelah beberapa kali gagal login, ada jeda/lockout sementara

---

## Skill 16 — Halaman Setting Admin (Ganti Username & Password)

**Tujuan:** Admin bisa mengubah username & password sendiri dari dashboard, tanpa perlu ubah langsung ke database.

**Perubahan Admin:**
- Halaman baru: **Pengaturan Akun** (`/admin/dashboard/pengaturan`), hanya bisa diakses setelah login.
- Form terdiri dari:
  - Username baru (opsional diubah)
  - Password saat ini (**wajib diisi** untuk verifikasi sebelum perubahan apa pun disimpan)
  - Password baru (opsional diubah)
  - Konfirmasi password baru (harus sama dengan password baru)

**Logika Backend:**
1. Ambil data admin yang sedang login dari session.
2. Cocokkan **password saat ini** yang diinput dengan hash password di database (`bcrypt.compare`) — jika tidak cocok, tolak seluruh perubahan dan tampilkan error, JANGAN proses field lain.
3. Jika password saat ini valid:
   - Jika username baru diisi & berbeda dari yang lama → validasi belum dipakai admin lain (kalau nanti ada multi-admin) → update.
   - Jika password baru diisi → validasi sama dengan konfirmasi → hash dengan `bcrypt` → update.
4. Setelah berhasil ubah password, **invalidasi session yang sedang aktif** dan minta admin login ulang dengan kredensial baru (langkah keamanan supaya sesi lama tidak terus valid).

**Validasi Tambahan:**
- Panjang password baru minimal 8 karakter (silakan sesuaikan kebijakan).
- Tampilkan pesan sukses/gagal yang jelas, tapi jangan bocorkan info spesifik (misal jangan bedakan pesan error antara "username salah" vs "password salah" pada proses verifikasi password saat ini — cukup "Password saat ini salah").

**Acceptance Criteria:**
- [ ] Perubahan gagal total jika password saat ini salah (tidak ada field lain yang ter-update)
- [ ] Password baru tersimpan dalam bentuk hash, bukan plain text
- [ ] Setelah ganti password, sesi admin lama otomatis logout dan harus login ulang
- [ ] Username baru tidak bisa kosong jika field itu diisi (validasi dasar)

---

## Skill 17 — Redesign Tampilan (Referensi PNG Baru)

**Tujuan:** Memperbarui tampilan frontend & admin mengikuti referensi desain PNG baru, yang layout-nya cukup berbeda dari versi awal — palet warna berubah (merah marun dihapus, hijau tua + emas + krem dipertahankan).

**Konteks penting:** Ini perubahan *presentasi*, bukan perubahan *logika bisnis*. Alur checkout, WhatsApp, status pesanan, dsb TIDAK berubah — hanya tampilannya.

### Pendekatan yang disarankan (jangan minta rombak semua sekaligus)
1. **Update dulu variabel warna global** (`--color-primary`, dst di CSS) sesuai `AGENTS.md` versi terbaru — ini otomatis akan mengubah warna di banyak komponen sekaligus tanpa perlu sentuh tiap file.
2. **Redesign per halaman**, bukan seluruh aplikasi dalam satu prompt. Urutan yang disarankan:
   - Beranda
   - Katalog produk
   - Detail produk
   - Keranjang & checkout
   - Dashboard admin (bisa belakangan, karena lebih fungsional daripada estetika)
3. Untuk tiap halaman: lampirkan PNG referensi halaman itu spesifik di Claude Code, lalu instruksikan misalnya:
   ```
   Ini referensi desain baru untuk halaman Beranda (lampiran PNG).
   Perbarui layout & styling halaman ini agar sesuai referensi:
   - [sebutkan detail: posisi hero, susunan grid produk, dsb]
   Jangan ubah logika data/fetching yang sudah ada, hanya struktur & style JSX/CSS-nya.
   Gunakan variabel warna dari :root yang sudah diperbarui (tanpa merah marun).
   ```
4. Setelah tiap halaman selesai, **cek dulu di browser** sebelum lanjut ke halaman berikutnya — supaya kalau ada yang meleset, ketahuan lebih awal dan tidak menumpuk revisi.

**Acceptance Criteria:**
- [ ] Tidak ada lagi warna merah marun (`#8B1E1E`) tersisa di kode manapun
- [ ] Semua halaman utama sudah disesuaikan dengan referensi PNG baru
- [ ] Fungsi/alur bisnis (checkout, WhatsApp, status pesanan, admin) tetap berjalan normal setelah redesign — tidak ada fitur yang rusak akibat perubahan tampilan
- [ ] Header menampilkan tombol "Chat via WhatsApp" persisten (selalu terlihat, bukan hanya di halaman produk)
- [ ] Ikon keranjang di header menampilkan badge angka jumlah item saat ada isi di keranjang
- [ ] Nama brand "Rasa Medan" + tagline "Oleh-oleh Khas Medan" konsisten dipakai di logo/header

---

## Skill 18 — Lokasi Toko & Info Kontak Diperluas

**Tujuan:** Menambahkan section Lokasi Toko dengan peta, jam operasional, dan tautan media sosial sesuai mockup terbaru.

**Peta Google Maps (tanpa perlu API key berbayar):**
- Gunakan **Google Maps Embed via iframe gratis**, bukan Maps JavaScript API (yang butuh billing account). Caranya:
  1. Buka Google Maps, cari lokasi toko.
  2. Klik "Bagikan" → tab "Sematkan peta" (Embed a map) → salin kode `<iframe>` yang diberikan.
  3. Simpan URL src dari iframe itu ke variabel environment, misal `NEXT_PUBLIC_MAPS_EMBED_URL`.
- Tombol "Buka di Google Maps" cukup link biasa ke URL Google Maps toko (bukan iframe).

**Environment Variables Baru (tambahkan ke `.env.example`):**
```
NEXT_PUBLIC_STORE_NAME="Rasa Medan"
NEXT_PUBLIC_STORE_ADDRESS="Jl. Sisingamangaraja No.123, Medan, Sumatera Utara, Indonesia"
NEXT_PUBLIC_MAPS_EMBED_URL=https://www.google.com/maps/embed?pb=...
NEXT_PUBLIC_MAPS_LINK_URL=https://maps.google.com/?q=...
NEXT_PUBLIC_STORE_HOURS_WEEKDAY="Senin-Sabtu 09.00-18.00 WIB"
NEXT_PUBLIC_STORE_HOURS_WEEKEND="Minggu: Tutup / by request"
NEXT_PUBLIC_IG_URL=https://instagram.com/rasamedan
NEXT_PUBLIC_TIKTOK_URL=https://tiktok.com/@rasamedan
NEXT_PUBLIC_FB_URL=https://facebook.com/rasamedan
```

**Perubahan Frontend:**
- Section baru di beranda: "Lokasi Toko Kami" — nama toko, alamat, embed peta, tombol "Buka di Google Maps", link "Lihat semua" (opsional, jika nanti ada multi-lokasi).
- Footer diperbarui: tambahkan blok Jam Operasional dan ikon-ikon media sosial (Instagram, TikTok, Facebook) yang mengarah ke env variable di atas.
- Section trust/USP baru (5 ikon): Halal & BPOM/PIRT, Pesan Tanpa Login, Konfirmasi via WhatsApp, Pengiriman Next-Day, Transaksi Aman — konten statis, tidak perlu database, cukup hardcode di komponen.

**Acceptance Criteria:**
- [ ] Peta tampil dan menunjuk ke lokasi toko yang benar
- [ ] Tombol "Buka di Google Maps" membuka tab baru ke lokasi yang sama
- [ ] Jam operasional & tautan sosial media bisa diubah lewat `.env` tanpa perlu ubah kode
- [ ] Section trust/USP tampil di beranda sesuai mockup (5 item)
- [ ] Semua elemen baru responsif di mobile

---

## Skill 19 — Optimasi SEO & Google Indexing

**Tujuan:** Memaksimalkan peluang situs muncul di hasil pencarian Google, baik untuk pencarian umum ("oleh-oleh khas Medan") maupun pencarian produk spesifik.

### 19.1 Metadata per Halaman (Next.js Metadata API)
- Gunakan `generateMetadata()` di setiap halaman (App Router) untuk mengatur:
  - `title` unik per halaman (misal: `"Bika Ambon Original - Rasa Medan | Oleh-oleh Khas Medan"`)
  - `description` unik & deskriptif (150-160 karakter), bukan generik
  - `canonical` URL untuk menghindari duplicate content (penting kalau ada filter/query string di URL katalog)

### 19.2 Open Graph & Twitter Card
- Setiap halaman produk & beranda perlu meta tag Open Graph (`og:title`, `og:description`, `og:image`, `og:url`) supaya tampilan link bagus saat dibagikan ke WhatsApp/Facebook/Instagram — ini juga membantu CTR dari pencarian.

### 19.3 Structured Data (JSON-LD)
Tambahkan schema markup supaya Google bisa menampilkan rich snippet (harga, stok, rating jika ada nanti):
- **Product schema** di setiap halaman detail produk (nama, harga, ketersediaan, gambar).
- **LocalBusiness schema** di halaman beranda/kontak, memakai data dari Skill 18 (nama toko, alamat, jam operasional, nomor telepon) — ini juga membantu Google Maps/Google Business terhubung ke situs.
- **BreadcrumbList schema** untuk navigasi (Beranda > Kategori > Produk).

### 19.4 Sitemap & Robots.txt
- Generate `sitemap.xml` otomatis (bisa pakai library `next-sitemap` atau route handler manual) yang mencakup semua halaman produk, kategori, dan halaman statis — regenerate otomatis saat ada produk baru.
- Buat `robots.txt` yang mengizinkan crawl ke halaman publik, tapi **blokir** halaman admin (`/admin/*`) dari indexing.

### 19.5 URL & Struktur Semantik
- Pastikan slug produk/kategori sudah SEO-friendly (huruf kecil, pakai tanda hubung, tanpa karakter aneh) — ini sudah sejalan dengan field `slug` yang ada di `dummy-products.json`.
- Struktur heading yang benar: satu `<h1>` per halaman (biasanya nama produk/judul halaman), `<h2>`/`<h3>` untuk sub-bagian.
- Semua gambar produk wajib punya atribut `alt` yang deskriptif (bukan kosong atau nama file), misal: `alt="Bika Ambon Original - Rasa Medan"`.

### 19.6 Performa (Core Web Vitals)
Google menjadikan kecepatan situs sebagai faktor ranking:
- Gunakan `next/image` untuk semua gambar produk (otomatis lazy-load & optimasi ukuran).
- Hindari layout shift: tentukan `width`/`height` gambar secara eksplisit.
- Minify CSS/JS otomatis lewat build Next.js (`next build` sudah menangani ini).

### 19.7 Dwibahasa (ID/EN) & SEO
- Tambahkan tag `hreflang` (`<link rel="alternate" hreflang="id" .../>` dan `hreflang="en"`) supaya Google tahu versi bahasa mana yang ditampilkan ke pengguna sesuai lokasi/preferensi mereka.

### 19.8 Langkah di Luar Kode (Harus Dilakukan Anda Sendiri)
Ini tidak bisa dikerjakan Claude Code karena butuh akses akun Anda:
1. Daftarkan situs ke **Google Search Console** (search.google.com/search-console), verifikasi kepemilikan (biasanya via meta tag yang ditambahkan Claude Code ke `<head>`, atau upload file verifikasi).
2. Submit `sitemap.xml` Anda lewat Search Console setelah situs live.
3. Daftarkan bisnis Anda ke **Google Business Profile** (business.google.com) — ini yang membuat toko Anda muncul di Google Maps & panel info bisnis saat orang cari nama toko Anda. Alamat & jam operasional bisa disamakan dengan yang ada di `.env` (Skill 18).
4. (Opsional, sangat disarankan) Setelah live, cek performa situs lewat **PageSpeed Insights** (pagespeed.web.dev) untuk memastikan skor Core Web Vitals baik.

**Acceptance Criteria:**
- [ ] Setiap halaman produk & kategori punya title/description unik (cek via view-source, bukan generik semua sama)
- [ ] `sitemap.xml` bisa diakses di `/sitemap.xml` dan mencakup semua produk
- [ ] `robots.txt` memblokir `/admin/*` tapi mengizinkan halaman publik
- [ ] Structured data lolos validasi di [Google Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Semua gambar produk punya atribut `alt` yang terisi
- [ ] Skor PageSpeed Insights (setelah deploy) minimal "Good" untuk Core Web Vitals utama

