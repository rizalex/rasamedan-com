# SKILLS.md — Rasa Medan
## Modul Kerja untuk Claude Code (Skill 1–30)

Satu-satunya daftar skill proyek ini. Per 12 Oktober 2026 file ini menggabungkan `SKILLS.md` lama (Skill 1–12) dan `SKILLS-ADDENDUM.md` (Skill 13–19), lalu menambahkan gerbang review (Skill 20–21) dan pelacakan pengiriman (Skill 22). Per 13 Oktober 2026 ditambahkan BAGIAN E: migrasi infrastruktur dari cPanel ke Cloudflare Workers (Skill 23–30).

- Requirement (sumber kebenaran): `PRD-Rasa-Medan_Toko-Oleh-Oleh-Medan.md`
- Aturan teknis & bisnis untuk agent: `CLAUDE.md`
- Deploy: `DEPLOYMENT.md`
- Subagent: `.claude/agents/` → `architect`, `code-reviewer`, `security-auditor`

---

## Alur Kerja Setiap Skill

Kerjakan **satu skill per sesi** Claude Code, berurutan:

1. **Rencana** — `Pakai subagent architect untuk merencanakan Skill N`. Wajib bila skill mengubah skema DB, API route, atau integrasi pihak ketiga; opsional untuk perubahan tampilan kecil.
2. **Implementasi** — oleh sesi utama, mengikuti rencana.
3. **Cek build** — `npx tsc --noEmit` dan `npm run build` harus lolos.
4. **Code review** — Skill 20.1 (`code-reviewer`).
5. **Security review** — Skill 21.1 (`security-auditor`), bila skill menyentuh login/sesi, API route, upload, captcha, form publik, environment variable, dependensi baru, atau layanan pihak ketiga.
6. **Perbaiki** temuan Kritis/Penting/Tinggi, lalu ulangi langkah 4–5 sampai bersih.
7. **Uji manual** sesuai Acceptance Criteria, lalu **commit** (satu commit per skill).
8. **Perbarui tabel status** di bawah.

---

## Status Skill (hasil audit kode, 12 Okt 2026)

| Skill | Topik | Status |
|---|---|---|
| 1–12 | MVP: setup & DB, dummy, beranda, katalog, detail, cart, checkout+WA, cek pesanan, admin, i18n, halaman pendukung, deploy | ✅ Selesai |
| 13 | Berat produk & info ongkir manual | ✅ Selesai — berat per varian kini bisa diisi dari admin (Skill 20.4) |
| 14 | Kategori dinamis | ✅ Selesai |
| 15 | Captcha (Turnstile) & hardening login | ✅ Turnstile di login, cek pesanan, checkout (Skill 21); fail-closed di production. AC "diuji di server" diganti: diuji di Workers saat deploy (21.3) |
| 16 | Pengaturan akun admin | ✅ Ganti password mencabut sesi di semua perangkat (`session_version`, Skill 21) |
| 17 | Redesign visual | ✅ Palet diterapkan; kesesuaian dengan mockup belum diverifikasi di browser |
| 18 | Lokasi toko & info kontak | ✅ Selesai |
| 19 | SEO & Google indexing | ⚠️ Kode selesai; hero dikompres 9 MB → 188 KB WebP + OG JPEG 145 KB (20.4). JSON-LD kini AggregateOffer untuk harga varian. 19.8 dikerjakan pemilik |
| 20 | Code review (gerbang kualitas) | ✅ Audit penuh 20.2 (13 Okt 2026): 5 Penting + 9 Minor diperbaiki; 20.3 lolos (tsc, build, lint ESLint baru, tanpa file _tmp); backlog 20.4 selesai kecuali tugas pemilik (ganti foto hero). Tetap berulang per skill |
| 21 | Security review & hardening | ✅ 21.2 no. 1–10 dikerjakan (13 Okt 2026, rincian di 21.2a); checklist 21.3 versi Cloudflare. ⏳ Pemilik: rotasi `ADMIN_SESSION_SECRET` di cPanel yang masih live + Workers, ganti password admin lama. Tetap berulang per skill (21.1) |
| 22 | Lacak pengiriman via api.co.id | 🆕 Rancangan; menunggu verifikasi 22.0 |
| 23 | Setup runtime Cloudflare Workers | ✅ Kode selesai (OpenNext build + preview lokal lolos, bundle 1,4 MiB gzip, secret .env disaring dari bundle). Deploy uji ke workers.dev menunggu pemilik (`wrangler login`, rotasi secret, `NEXT_PUBLIC_SITE_URL`) |
| 24 | Migrasi database MySQL → D1 | ✅ Kode selesai (14 Okt 2026): `migrations/0001_init.sql`, `lib/db.ts` D1, semua route via `batch()`/`queryIn`, `mysql2` dihapus; E2E 54 skenario (termasuk checkout 50 baris) lolos di `next dev` + preview workerd (D1 lokal). ⏳ Pemilik: `wrangler d1 create rasamedan` + isi `database_id` (deploy diblokir sampai diisi) |
| 26 | Rewrite auth untuk Workers | ✅ Kode selesai (14 Okt 2026): PBKDF2-SHA256 Web Crypto (30.000 iterasi, terukur ±5 ms) + HMAC `crypto.subtle`, auth async penuh, `seed:admin` PBKDF2; hash scrypt lama ditolak (reset admin). Rincian 26a |
| 25, 27–30 | Migrasi cPanel → Cloudflare Workers (BAGIAN E) | 🆕 Direncanakan 13 Okt 2026 (keputusan: D1, R2, Turnstile, Workers Free). Dikerjakan sebelum Skill 22 |

---

# BAGIAN A — MVP (Skill 1–12)

## Skill 1 — Setup Proyek & Database

**Tujuan:** Fondasi proyek siap jalan.

- Inisialisasi Next.js (App Router) + koneksi MySQL (`lib/db.ts`).
- Buat schema tabel: `products`, `product_variants`, `orders`, `order_items`, `admin_users`.
- Setup `.env.example` berisi: `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `NEXT_PUBLIC_WA_NUMBER`, `ADMIN_SESSION_SECRET`.
- Setup i18n dasar (folder `/locales/id.json`, `/locales/en.json`).

**Acceptance Criteria:**
- [ ] Server bisa `next dev` tanpa error
- [ ] Koneksi ke MySQL berhasil (test query sederhana)
- [ ] Struktur tabel sudah mengikuti `PRD` bagian 5.2

---

## Skill 2 — Data Dummy Produk

**Tujuan:** Ada data untuk development UI tanpa perlu isi manual dulu.

- Gunakan file `data/dummy-products.json` (sudah disediakan terpisah).
- Buat seed script (`scripts/seed.js` atau `.sql`) untuk memasukkan dummy ke MySQL.

**Acceptance Criteria:**
- [ ] Minimal 9 produk dummy (3 per kategori: Kue, Kering, Sirup)
- [ ] Setiap produk punya: nama, kategori, harga, status stok, label halal, variasi, deskripsi

---

## Skill 3 — Halaman Beranda

- Hero section dengan warna tema (lihat `CLAUDE.md` bagian 5).
- Section highlight kategori (Kue/Kering/Sirup) dengan link ke katalog terfilter.
- Banner info: estimasi kirim H+1 & opsi ambil sendiri tersedia.
- Toggle bahasa di header (id/en).

**Acceptance Criteria:**
- [ ] Tampil benar di mobile (375px) dan desktop
- [ ] Toggle bahasa mengubah semua teks statis di halaman ini

---

## Skill 4 — Katalog Produk

- Grid produk dari data (dummy dulu, lanjut dari DB).
- Filter kategori (chip/tab: Semua, Kue, Kering, Sirup).
- Search bar (client-side filter untuk MVP, cukup cepat untuk jumlah produk kecil).
- Badge status stok per kartu produk (4 warna sesuai PRD 3.2).

**Acceptance Criteria:**
- [ ] Filter & search bisa dikombinasikan
- [ ] Badge stok sesuai 4 kondisi: Tersedia/Terbatas/Pre-order/Tanya Stok

---

## Skill 5 — Halaman Detail Produk

- 1 foto utama, nama, harga, kategori.
- Label Halal (badge ikon jika `is_halal: true`).
- Pilihan variasi (dropdown/chip) — jika produk punya variasi.
- Deskripsi & bahan-bahan (Bahasa Indonesia saja).
- Tombol "Tambah ke Keranjang" ATAU tombol "Tanya Stok via WhatsApp" (jika status = Tanya Stok).

**Acceptance Criteria:**
- [ ] Tombol WA membuka `wa.me` dengan teks otomatis berisi nama produk
- [ ] Variasi yang dipilih terbawa ke keranjang

---

## Skill 6 — Keranjang (Cart)

- State disimpan di `localStorage` (bukan server/DB), sinkron dengan React Context/state.
- List item + variasi + qty + subtotal.
- Update qty / hapus item.
- Tombol lanjut ke Checkout.

**Acceptance Criteria:**
- [ ] Refresh halaman tidak menghilangkan isi keranjang (persist di localStorage)
- [ ] Total harga terhitung otomatis

---

## Skill 7 — Checkout & Integrasi WhatsApp

- Pilihan metode: **Kurir** (form lengkap: nama penerima, alamat, kecamatan/kota, catatan lokasi, no HP) atau **Ambil Sendiri** (form ringkas: nama, no HP).
- Generate **Order ID** unik (`ORD-YYYYMMDD-XXXX`) saat submit.
- Simpan order + order_items ke MySQL dengan status awal `Menunggu Konfirmasi`.
- Redirect/buka tab baru ke `wa.me/{NEXT_PUBLIC_WA_NUMBER}?text={pesan-encoded}` berisi: Order ID, daftar item, metode pengambilan, data pelanggan.

**Acceptance Criteria:**
- [ ] Order ID tidak pernah duplikat
- [ ] Pesan WhatsApp otomatis-terisi sudah benar formatnya dan ter-encode URL dengan benar
- [ ] Data tersimpan di DB sebelum redirect ke WhatsApp

---

## Skill 8 — Cek Status Pesanan (Tanpa Akun)

- Form input nomor HP (dan opsional Order ID) untuk cari pesanan.
- Tampilkan daftar pesanan milik nomor HP tsb + status terkini (badge warna per status, lihat PRD 2.1).

**Acceptance Criteria:**
- [ ] Pencarian aman dari SQL injection (gunakan parameterized query)
- [ ] Tidak menampilkan data pesanan milik nomor HP lain

---

## Skill 9 — Dashboard Admin

- Halaman login admin (session-based, bukan untuk pelanggan).
- CRUD Produk: tambah/edit/hapus, upload 1 foto (simpan ke `/public/uploads`), atur kategori/harga/variasi/deskripsi/halal/status stok.
- Kelola Pesanan: list semua order, detail per order, ubah status (dropdown sesuai daftar status baku).
- Filter/pencarian order by status atau no HP/Order ID.

**Acceptance Criteria:**
- [ ] Halaman admin tidak bisa diakses tanpa login (redirect ke `/admin/login`)
- [ ] Upload foto tervalidasi (tipe file gambar, ukuran maksimum wajar)
- [ ] Perubahan status order langsung reflect di halaman "Cek Pesanan" pelanggan

---

## Skill 10 — i18n Penuh (ID/EN)

- Semua teks statis UI (navigasi, tombol, label status, form, notifikasi) tersedia dalam 2 bahasa.
- Deskripsi & nama produk TETAP Bahasa Indonesia saja (sesuai keputusan scope).

**Acceptance Criteria:**
- [ ] Tidak ada teks UI yang hardcoded di luar file locale
- [ ] Toggle bahasa persist selama sesi browsing (localStorage/cookie)

---

## Skill 11 — Halaman Pendukung

- Tentang Kami, Kontak, kebijakan pengiriman singkat.

**Acceptance Criteria:**
- [ ] Konten mudah diedit (idealnya dari data/CMS ringan, minimal dari file config)

---

## Skill 12 — Persiapan Deployment cPanel

- Pastikan `next build` + `next start` berjalan mulus (tidak bergantung fitur khusus Vercel).
- Buat panduan singkat `DEPLOYMENT.md`: langkah setup Node.js App di cPanel, cara set environment variables, cara import schema MySQL via phpMyAdmin.

**Acceptance Criteria:**
- [ ] Aplikasi bisa di-build dan dijalankan dengan `npm run build && npm start`
- [ ] Tidak ada dependency yang butuh native binary sulit di-compile di shared hosting

---

# BAGIAN B — Pasca-MVP (Skill 13–19)

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

## Skill 15 — Keamanan Login & Form Publik: Cloudflare Turnstile + Hardening

**Tujuan:** Melindungi login admin dan form Cek Pesanan dari bot dan brute force. **Cloudflare Turnstile menggantikan Google reCAPTCHA v2**, karena reCAPTCHA bermasalah saat deploy production di cPanel.

> **Riwayat & status:** versi awal skill ini memakai reCAPTCHA v2 (`lib/recaptcha.ts`). Per 12 Okt 2026, kode di repo **masih reCAPTCHA**; belum ada commit Turnstile. Bila Turnstile sudah Anda bangun di tempat lain (langsung di server atau branch lain), satukan ke repo ini dulu, lalu cocokkan dengan 15.2 dan centang Acceptance Criteria.

### 15.1 Setup akun (pemilik, bukan Claude Code)
1. Buka https://dash.cloudflare.com → **Turnstile** → **Add widget**. Mode: *Managed*. Hostname: domain production (tambahkan `localhost` untuk development).
2. Catat **Site Key** dan **Secret Key**.
3. Isi di panel **Setup Node.js App** cPanel dan di `.env` lokal (jangan di file yang di-commit):
   ```
   TURNSTILE_SITE_KEY=...
   TURNSTILE_SECRET_KEY=...
   ```
4. Untuk development boleh memakai test key resmi Cloudflare:
   - Selalu lolos: site key `1x00000000000000000000AA` + secret `1x0000000000000000000000000000000AA`
   - Selalu gagal (uji jalur error): site key `2x00000000000000000000AB` + secret `2x0000000000000000000000000000000AA`
   - Token sudah dipakai: secret `3x0000000000000000000000000000000AA`

   Test key **tidak boleh** dipakai di production.

### 15.2 Yang dikerjakan Claude Code
**Lingkup: semua tempat yang sekarang memakai reCAPTCHA** (bukan hanya login admin):

| Lokasi | Perubahan |
|---|---|
| `lib/recaptcha.ts` | Ganti menjadi `lib/turnstile.ts` dengan fungsi `isCaptchaEnabled()`, `getCaptchaSiteKey()`, `verifyCaptcha(token, ip)` |
| `app/api/admin/auth/route.ts` | Field body `recaptchaToken` → `captchaToken` |
| `app/api/orders/route.ts` (GET) | Verifikasi token Turnstile pada pencarian pesanan |
| `app/admin/login/page.tsx`, `app/cek-pesanan/page.tsx` | Site key tetap dibaca di server dan dikirim sebagai prop (agar bisa diganti tanpa build ulang) |
| `components/admin/LoginForm.tsx`, `components/order/CheckOrderView.tsx` | Logika widget yang sekarang duplikat dijadikan satu komponen `components/security/CaptchaWidget.tsx` |
| `locales/id.json`, `locales/en.json`, `components/admin/admin.module.css` | Teks "centang reCAPTCHA" diganti netral; class CSS disesuaikan |
| `.env.example`, `README.md`, `DEPLOYMENT.md` | `RECAPTCHA_*` → `TURNSTILE_*` |

**Detail teknis:**
- **Client:** muat `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`, render dengan `window.turnstile.render(el, { sitekey, callback, "expired-callback", "error-callback" })`, dan panggil `turnstile.reset(widgetId)` setelah setiap submit. Token **sekali pakai** dan berlaku **300 detik**.
- **Server:** `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` (form-urlencoded) berisi `secret`, `response`, dan `remoteip` (opsional). Lolos hanya bila `success === true`. Disarankan juga mencocokkan `hostname` dengan domain di `NEXT_PUBLIC_SITE_URL`. Timeout fetch 8 detik → dianggap gagal.
- **Fail-closed di production:** bila `NODE_ENV=production` dan `TURNSTILE_SECRET_KEY` kosong, **tolak** request. Jangan dilewati diam-diam seperti perilaku reCAPTCHA sekarang. Mode lewati hanya boleh di development.
- **Urutan cek tetap:** rate limit → captcha → cek kredensial/query DB.
- Setelah selesai, `grep -ri recaptcha app components lib locales` harus kosong.
- Bila nanti menambah Content-Security-Policy (Skill 21.2 no. 8), izinkan `https://challenges.cloudflare.com` di `script-src` dan `frame-src`.

### 15.3 Hardening yang sudah ada (pertahankan)
- Rate limit 5 kegagalan / 15 menit per IP (`lib/rate-limit.ts`).
- Password admin di-hash dengan scrypt (`lib/auth.ts`). *(Sejak Skill 26: PBKDF2-SHA256 via Web Crypto, `lib/password.mjs`.)*
- Cookie sesi `httpOnly`, `secure` di production, `sameSite=strict`.
- HTTPS wajib di production (lihat `DEPLOYMENT.md`).

### 15.4 Kendala cPanel yang perlu dicek
- Server harus boleh melakukan request keluar ke `challenges.cloudflare.com`. Sebagian shared hosting memblokir koneksi keluar. Uji login dengan key asli **di server**; bila gagal karena error jaringan, minta provider membuka akses.
- Hostname widget harus sama persis dengan domain production, termasuk `www` bila dipakai.

**Acceptance Criteria:**
- [ ] Login admin dan Cek Pesanan menolak request tanpa token Turnstile yang valid, dan verifikasinya terjadi di server
- [ ] Token yang dipakai ulang ditolak (`timeout-or-duplicate`) dan widget ter-reset setelah setiap submit
- [ ] Di production tanpa secret, request ditolak (bukan dilewati)
- [ ] Tidak ada sisa kode atau teks reCAPTCHA
- [ ] Rate limit tetap berjalan dan urutan cek tidak berubah
- [ ] Sudah diuji di server cPanel sungguhan, bukan hanya di lokal

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
2. Cocokkan **password saat ini** yang diinput dengan hash password di database (`verifyPassword`, PBKDF2 sejak Skill 26) — jika tidak cocok, tolak seluruh perubahan dan tampilkan error, JANGAN proses field lain.
3. Jika password saat ini valid:
   - Jika username baru diisi & berbeda dari yang lama → validasi belum dipakai admin lain (kalau nanti ada multi-admin) → update.
   - Jika password baru diisi → validasi sama dengan konfirmasi → hash dengan `hashPassword` (PBKDF2 sejak Skill 26) → update.
4. Setelah berhasil ubah password, **invalidasi session yang sedang aktif** dan minta admin login ulang dengan kredensial baru (langkah keamanan supaya sesi lama tidak terus valid).

**Validasi Tambahan:**
- Panjang password baru minimal 12 karakter (semula 8; dinaikkan di Skill 26 sebagai kompensasi iterasi PBKDF2).
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
1. **Update dulu variabel warna global** (`--color-primary`, dst di CSS) sesuai `CLAUDE.md` bagian 5 — ini otomatis akan mengubah warna di banyak komponen sekaligus tanpa perlu sentuh tiap file.
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

---

# BAGIAN C — Gerbang Kualitas (Skill 20–21)

Kedua skill ini **berulang**: dijalankan pada setiap skill lain (lihat "Alur Kerja Setiap Skill"), bukan dikerjakan sekali lalu selesai. Subagent-nya hanya membaca dan melaporkan; perbaikan dikerjakan sesi utama, sehingga agent yang menilai tidak menilai pekerjaannya sendiri.

---

## Skill 20 — Code Review

**Tujuan:** Setiap perubahan direview sebelum commit, dan seluruh kode diaudit berkala, supaya bug dan pelanggaran aturan bisnis tertangkap sebelum sampai ke pelanggan.

**Alat:** subagent `code-reviewer` (`.claude/agents/code-reviewer.md`).

### 20.1 Mode per-skill (wajib di setiap skill)
Setelah implementasi dan build lolos:
```
Pakai subagent code-reviewer untuk review perubahan Skill N yang belum di-commit.
Cocokkan dengan Acceptance Criteria Skill N di SKILLS.md.
```
Perbaiki temuan **Kritis** dan **Penting** di sesi utama, lalu jalankan review ulang sampai bersih. Temuan **Minor** boleh dicatat ke backlog 20.4.

### 20.2 Mode audit penuh (sebelum deploy, dan setiap ±5 skill)
```
Pakai subagent code-reviewer untuk audit seluruh kode di app/, components/, lib/, scripts/, dan db/.
Fokus: konsistensi daftar status pesanan di semua lokasi, harga dihitung ulang di server,
transaksi DB, i18n, dan fitur yang diklaim README tetapi tidak terhubung end-to-end.
```

### 20.3 Pemeriksaan otomatis yang harus lolos
- `npx tsc --noEmit` tanpa error
- `npm run build` sukses
- `npm run lint` (bila sudah dikonfigurasi)
- Tidak ada file sementara/debug yang ter-track: `git ls-files | grep -E "_tmp|probe"` kosong

### 20.4 Backlog dari audit 12 Okt 2026 (verifikasi ulang sebelum dikerjakan)
- **Berat per varian** tidak bisa diisi dari admin (`replaceVariants` di `lib/product-admin.ts` selalu menulis 0) → Skill 13 belum lengkap.
- **`price_delta` varian** tidak dipakai di kode, padahal README menyebutnya terbawa ke keranjang → implementasikan atau hapus klaim di README.
- **`is_featured`** tidak punya UI admin → "Produk pilihan" di beranda sebenarnya produk ber-id terkecil.
- **Fallback diam-diam ke `data/dummy-products.json`** saat query DB gagal di production → checkout kemudian gagal "Produk tidak ditemukan" tanpa ada yang tahu DB bermasalah. Di production sebaiknya tampilkan pesan error dan tulis log.
- **`public/images/hero-medan.png` 9 MB** dipakai sebagai hero, OG image, dan gambar JSON-LD → kompres ke WebP ±200 KB. Ganti juga foto yang memuat label merek pihak lain dengan foto produk sendiri.
- **PNG mockup ±12 MB ikut di repo** (`Generated_Image_*.png`, `rasamedan_frontend.png`, `rasamedan_backend.png`) → pindahkan keluar repo.
- **i18n:** 8 string di `en.json` belum diterjemahkan; ±9 pesan di komponen admin masih hardcode. Putuskan apakah admin cukup berbahasa Indonesia, lalu catat keputusan itu di `CLAUDE.md`.
- **Dokumen:** header PRD masih "Versi 1.0" padahal sudah memuat revisi v1.1.

### 20.5 Status backlog 20.4 & audit 20.2 (13 Okt 2026)
| Butir | Status |
|---|---|
| Berat per varian dari admin | ✅ Editor varian terstruktur (nama, selisih harga, berat) di form admin |
| `price_delta` | ✅ Diimplementasikan (keputusan pemilik): admin → detail (harga berubah per varian) → keranjang → checkout dihitung ulang server → WhatsApp → JSON-LD AggregateOffer. Rumus tunggal di `lib/pricing.ts`. Produk bervarian wajib memilih varian (server menolak `VARIANT_REQUIRED`) |
| `is_featured` | ✅ Checkbox di admin + badge "Pilihan"; beranda menampilkan produk pilihan saja (fallback produk terbaru bila belum ada). Judul bagian menjadi "Produk Pilihan" |
| Fallback dummy diam-diam | ✅ Keputusan pemilik: dummy hanya di development; production menampilkan halaman error (`app/error.tsx`) + log. ⚠️ Situs uji workers.dev menampilkan error sampai Skill 24 (D1) |
| Hero 9 MB | ✅ Dikompres (WebP 188 KB untuk hero, JPEG 145 KB untuk OG). ⏳ **Pemilik:** ganti foto — memuat label merek pihak lain ("SIRUP KURNIA", "Bika Ambon Zulaikha", "Bolu Gulung Meranti") dan watermark AI |
| PNG mockup di repo | ✅ Dipindah ke `../rasamedan-design/` (di luar repo) |
| i18n admin | ✅ Keputusan pemilik: admin cukup Bahasa Indonesia — dicatat di CLAUDE.md §4 |
| Header PRD | ✅ Versi 1.1 |
| Audit 20.2 — Penting | ✅ Label kategori kustom di detail; normalisasi nomor HP (simpan & cari); kategori default di `db/schema.sql` + form admin tanpa fallback palsu; filter katalog ikut URL; `seed:admin` tidak menimpa akun (`--reset` eksplisit) |
| Audit 20.2 — Minor diperbaiki | Placeholder reCAPTCHA dikosongkan; zona waktu WIB; PATCH status 404 + error tampil di admin; `seed` dengan pengaman `--force` & transaksi tanpa DDL; pemberitahuan harga berubah di checkout; varian wajib; batas panjang & slug dinormalisasi; escape JSON-LD (juga 21.2 no. 7); dokumen 6 tabel |
| Batas yang diterima / catatan | Beranda hanya menampilkan produk yang ditandai (tidak dilengkapi sampai 6) — disengaja. Harga di keranjang lama tidak disegarkan otomatis; server selalu menghitung ulang dan layar sukses memberi tahu bila total berubah. **Skill 24:** deteksi 404 PATCH status memakai `affectedRows` (mysql2 = baris cocok) → sesuaikan ke `meta.changes`/cek keberadaan di D1 |
| Audit 20.2 — Minor terbuka (keputusan konten) | ⏳ Teks Tentang/Kontak/kebijakan pengiriman (`data/site-info.json`) belum ada versi EN — kecualikan seperti deskripsi produk, atau terjemahkan? ⏳ Alamat & jam toko punya dua sumber yang isinya berbeda (`site-info.json` vs env `NEXT_PUBLIC_STORE_*`) + email `halo@rasamedan` tanpa TLD — pemilik memilih satu sumber & data yang benar |

**Acceptance Criteria:**
- [ ] Setiap skill punya review `code-reviewer` tanpa temuan Kritis/Penting sebelum di-commit
- [ ] Semua pemeriksaan 20.3 lolos
- [ ] Tiap butir backlog 20.4 dikerjakan, atau diputuskan "tidak dikerjakan" dengan alasan tercatat

---

## Skill 21 — Security Review & Hardening

**Tujuan:** Menutup celah keamanan yang nyata sebelum go-live, dan memastikan setiap perubahan sensitif diaudit.

**Alat:** subagent `security-auditor` (`.claude/agents/security-auditor.md`). Agent ini hanya membaca dan tidak menampilkan nilai rahasia.

### 21.1 Kapan dijalankan
- Setiap skill yang menyentuh login/sesi, API route, upload, captcha, form publik, environment variable, dependensi baru, atau layanan pihak ketiga (mis. Skill 15 dan 22):
  ```
  Pakai subagent security-auditor untuk audit perubahan Skill N.
  ```
- Wajib sebelum setiap deploy ke cPanel:
  ```
  Pakai subagent security-auditor untuk audit penuh sebelum deploy, lalu isi checklist 21.3.
  ```

### 21.2 Perbaikan wajib dari audit 12 Okt 2026 (kerjakan berurutan)
1. **[Kritis] Rotasi `ADMIN_SESSION_SECRET`.** Nilai aslinya pernah ter-commit di `.env.example` (commit `ca47eef`, sudah ada di GitHub). Siapa pun yang memegang nilai itu bisa membuat cookie admin yang valid tanpa login.
   - *Pemilik:* buat secret baru (`openssl rand -hex 32`), pasang di panel Node.js App cPanel dan `.env` lokal, lalu restart aplikasi. Semua admin akan ter-logout; itu memang yang diharapkan.
   - *Claude Code:* ganti nilai di `.env.example` menjadi placeholder. Riwayat git tetap menyimpan nilai lama, jadi **rotasi** adalah perbaikan yang sebenarnya; menulis ulang riwayat git tidak wajib setelah secret dirotasi.
2. **[Tinggi] Hapus fallback secret** di `lib/auth.ts`. Di production, tanpa `ADMIN_SESSION_SECRET` (atau bila kurang dari 32 karakter) aplikasi harus menolak login, bukan memakai string hardcode `"dev-insecure-secret-change-me"`.
3. **[Tinggi] Lindungi `POST /api/orders`** dari banjir pesanan palsu:
   - Pasang Turnstile (Skill 15) di form checkout.
   - Rate limit, mis. 10 pesanan per jam per IP.
   - Batas panjang input: nama ≤100, alamat ≤500, catatan ≤500 karakter.
   - Batas isi: ≤50 baris item, qty ≤99 per baris.
4. **[Sedang] Sumber IP untuk rate limit.** Entri paling kiri `X-Forwarded-For` bisa diisi klien. Di server, log isi `x-forwarded-for` dan `x-real-ip` dari request uji untuk melihat header mana yang ditimpa proxy cPanel/Passenger, lalu ambil IP dari posisi yang dipercaya (biasanya entri yang ditambahkan proxy, paling kanan).
5. **[Sedang] Cabut sesi saat ganti password.** Tambah kolom `admin_users.session_version INT NOT NULL DEFAULT 0` (dengan migrasi idempotent), masukkan nilainya ke payload token, cocokkan di `getAdminSession()`, dan naikkan saat password diganti. Sesi di perangkat lain otomatis tidak berlaku lagi.
6. **[Sedang] Upload foto.** Validasi *magic bytes* (JPEG/PNG/WEBP/GIF), jangan percaya `file.type` dari klien. Pastikan `public/uploads` tidak bisa mengeksekusi skrip (di cPanel: `.htaccess` yang mematikan handler PHP/CGI di folder itu).
7. **[Rendah] JSON-LD.** Di `components/seo/JsonLd.tsx`, escape `<` (`JSON.stringify(data).replace(/</g, "\\u003c")`) karena nama dan deskripsi produk berasal dari DB.
8. **[Rendah] Header keamanan** lewat `headers()` di `next.config.mjs` (aman untuk cPanel): `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, dan CSP dasar yang tetap mengizinkan embed Google Maps dan Turnstile.
9. **[Rendah] Kebersihan repo.** Hapus `scripts/_tmp_dbtest.mjs` dari git. Tambahkan `.claude/settings.local.json` ke `.gitignore`, lalu keluarkan dari git dengan `git rm --cached`.
10. **[Rendah] Password admin default** (`admin123` dari `npm run seed:admin`) wajib diganti sebelum go-live. *(13 Okt 2026: `seed:admin` kini menolak jalan tanpa `ADMIN_PASSWORD` ≥ 12 karakter dan tidak menimpa akun yang ada — akun BARU tidak bisa lagi dibuat dengan password default. Akun lama yang terlanjur memakai `admin123` tetap harus diganti pemilik.)*

### 21.2a Status pengerjaan (13 Okt 2026)
| No. | Status |
|---|---|
| 1 | ✅ Kode: `.env.example` kosong, nilai bocor ditolak (blocklist hash), fail-closed di production; `.env` lokal sudah dirotasi. ⏳ **Pemilik:** rotasi di panel cPanel yang masih live (kode lama di sana masih menerima nilai bocor) + `wrangler secret put ADMIN_SESSION_SECRET` |
| 2 | ✅ |
| 3 | ✅ Rate limit atomik, batas input/item/total, varian wajib, JSON-only (415), **Turnstile** di checkout, login, dan cek pesanan (menutup Skill 15). Cek pesanan pindah ke `POST /api/orders/lookup` (nomor HP tidak lagi di URL/log) |
| 4 | ✅ `lib/client-ip.ts`: `cf-connecting-ip` dipercaya di production hanya bila `TRUST_CF_CONNECTING_IP=1` (var di `wrangler.jsonc` — di Workers header ditimpa edge; `next start` terbuka tanpa Cloudflare tidak memercayainya); IPv4-mapped IPv6 dinormalisasi; XFF tidak pernah dipercaya di production (dev: entri paling kanan); IPv6 dikelompokkan per /64; tanpa IP → ember bersama `noip` (lebih ketat). Analisis proxy cPanel tidak relevan lagi (`main` tidak deploy ke cPanel) |
| 5 | ✅ `admin_users.session_version` (schema + `npm run db:migrate:session`), dicek di `getAdminSession()` per request, naik atomik saat ganti password. Kolom belum ada → admin ditolak (fail-closed). Bukan pengganti rotasi secret |
| 6 | ✅ Magic bytes (`lib/image-type.ts`), ekstensi & nama file dari server. `.htaccess` **tidak dikerjakan** (keputusan tercatat): `main` tidak deploy ke cPanel, aset Workers/R2 tidak pernah dieksekusi, dan upload hanya bisa menghasilkan jpg/png/webp/gif. Field `image` produk kini dibatasi ke `/uploads/` & `/images/` |
| 7 | ✅ (Skill 20) |
| 8 | ✅ `next.config.mjs`: CSP (Turnstile + iframe peta; `'unsafe-inline'` karena tanpa middleware/nonce), nosniff, Referrer-Policy, X-Frame-Options DENY, Permissions-Policy. HSTS diatur di dashboard Cloudflare saat cutover |
| 9 | ✅ `_tmp_dbtest.mjs` dihapus (Skill 20); `.claude/settings.local.json` di-ignore & keluar dari git |
| 10 | ✅ Kode: `seed:admin` wajib `ADMIN_PASSWORD` ≥ 12. ⏳ **Pemilik:** ganti password akun lama bila masih default |

Masih terbuka di skill lain (bukan Skill 21): rate limit in-memory tidak andal antar-isolate Workers → tabel D1 (Skill 28); hashing scrypt → PBKDF2 (Skill 26, selesai); upload ke R2 (Skill 27).

### 21.3 Checklist pre-deploy Cloudflare Workers (isi setiap kali deploy)
- [ ] Audit penuh `security-auditor`: tidak ada temuan Kritis/Tinggi yang masih terbuka
- [ ] `ADMIN_SESSION_SECRET` via `wrangler secret put`, ≥32 karakter acak, belum pernah ter-commit, berbeda dari dev
- [ ] `TURNSTILE_SECRET_KEY` via `wrangler secret put` + `TURNSTILE_SITE_KEY` di `vars` `wrangler.jsonc`, bukan test key; hostname widget = domain production (+ workers.dev bila staging); `ALLOW_TEST_CAPTCHA` TIDAK diset; login, cek pesanan, checkout diuji di URL deploy
- [ ] `NEXT_PUBLIC_SITE_URL` = domain https asli **saat build** (`npm run deploy` otomatis menolak localhost/http/site key kosong lewat `scripts/check-deploy-env.mjs`); `npm run cf:build` menampilkan `[strip-bundle-secrets] OK`
- [ ] Migrasi DB terbaru diterapkan ke D1 production (`npm run db:migrate:remote`)
- [ ] Password admin default sudah diganti
- [ ] `curl -I https://<domain>/` menampilkan CSP, nosniff, X-Frame-Options, Referrer-Policy; tidak ada pelanggaran CSP di console (beranda + peta, produk, checkout + widget, cek pesanan, admin)
- [ ] SSL Cloudflare aktif; HSTS diaktifkan di dashboard (Skill 30)
- [ ] `npm audit --omit=dev` tanpa celah tinggi yang relevan; bundle Worker ≤ 3 MiB (`npm run cf:dryrun`)
- [ ] Tidak ada `.env`/`.dev.vars` di repo atau bundle

**Acceptance Criteria:**
- [ ] Butir 21.2 no. 1–3 selesai sebelum go-live
- [ ] Butir 21.2 no. 4–10 selesai, atau diputuskan dengan alasan tercatat
- [ ] Checklist 21.3 terisi pada setiap deploy


---

# BAGIAN D — Fitur Baru

## Skill 22 — Lacak Pengiriman (Tracking Resi) via api.co.id

**Tujuan:** Setelah pesanan dikirim, pelanggan bisa melihat posisi paketnya langsung di halaman Cek Pesanan, tanpa perlu bertanya ke admin lewat WhatsApp. Ini mendukung metrik PRD §7 (mengurangi chat "pesanan saya sampai mana?").

**Batas lingkup (tetap sesuai `CLAUDE.md` §6):** skill ini **hanya melacak**. Ongkir tetap dihitung manual oleh pemilik, pemesanan kurir tetap manual, dan status pesanan tetap diubah manual oleh admin.

### 22.0 Verifikasi sebelum coding — GERBANG (dikerjakan pemilik)
Halaman produk api.co.id hanya menjelaskan tracking untuk pengiriman yang **dibuat lewat API mereka** (`POST /courier/v1/orders`). Belum jelas apakah endpoint tracking juga menerima nomor resi dari kiriman yang Anda pesan sendiri di agen atau aplikasi kurir. Jawaban ini menentukan seluruh desain, jadi pastikan dulu:

1. Daftar di https://api.co.id dan ambil API key (dikirim lewat header `x-api-co-id`).
2. Baca dokumentasi Kurir API: https://docs.api.co.id/kurir-api/getting-started
3. Uji `GET https://use.api.co.id/courier/v1/orders/track/{resi}` dengan **satu nomor resi asli** dari kiriman Anda sebelumnya (JNE/J&T/SiCepat), atau tanyakan langsung ke sales api.co.id lewat WhatsApp di halaman produk mereka.
4. Catat hasilnya:
   - [ ] Resi dari kiriman di luar api.co.id didukung? Ya / Tidak
   - [ ] Contoh respons JSON asli (tanpa data pribadi) disimpan di `docs/api-co-id-track-sample.json`
   - [ ] Daftar kode kurir dari `GET /courier/v1/couriers`
   - [ ] Biaya tracking (halaman produk menyebut gratis; konfirmasi)

**Keputusan berdasarkan hasil:**
- **Jalur A — resi eksternal didukung:** kerjakan 22.1 sampai 22.6.
- **Jalur B — hanya pengiriman yang dibuat lewat api.co.id:** tracking menuntut Anda memesan kurir lewat API (saldo terpotong, butuh kode kecamatan asal/tujuan dan alamat pickup). Itu mengubah alur bisnis PRD §2, jadi **jangan dikerjakan di skill ini**. Minta `architect` merancang skill terpisah dan perbarui PRD lebih dulu. Sementara itu kerjakan **jalur cadangan**: 22.1–22.3 saja, dengan menampilkan resi dan tautan ke halaman lacak resmi kurir, tanpa memanggil API.

### 22.1 Data
Migrasi idempotent `scripts/migrate-add-shipment.mjs` (daftarkan di `package.json`), dan perbarui `db/schema.sql`:
```sql
ALTER TABLE orders
  ADD COLUMN courier_code        VARCHAR(30) NULL AFTER fulfillment_method,
  ADD COLUMN waybill             VARCHAR(50) NULL AFTER courier_code,
  ADD COLUMN shipped_at          DATETIME    NULL AFTER waybill,
  ADD COLUMN tracking_summary    TEXT        NULL,  -- JSON ternormalisasi, bukan payload mentah
  ADD COLUMN tracking_checked_at DATETIME    NULL,
  ADD KEY idx_orders_waybill (waybill);
```
Kolom `tracking_summary` memakai `TEXT` (bukan `JSON`) agar aman di MySQL maupun MariaDB cPanel.

### 22.2 Admin: input kurir & resi
- Di `/admin/pesanan`, untuk pesanan bermetode kurir: dropdown kurir dan field nomor resi. Daftar kurir (kode api.co.id hasil 22.0, nama tampil, dan URL lacak resmi yang sudah diverifikasi) disimpan di `lib/couriers.ts`.
- Endpoint baru `PATCH /api/admin/orders/[id]/shipment`, dengan `getAdminSession()` di awal. Validasi: kode kurir ada di daftar, resi cocok dengan `^[A-Za-z0-9-]{6,40}$`, dan pesanan bermetode `kurir`. Isi `shipped_at` saat resi pertama kali disimpan.
- Saat status diubah ke `Dikirim` tanpa resi, tampilkan peringatan (bukan blokir, karena pemilik bisa saja mengisinya belakangan).
- Daftar status pesanan **tidak berubah** (PRD §2.1).

### 22.3 Pelanggan: tampilan di Cek Pesanan
- Untuk pesanan yang sudah punya resi: tampilkan nama kurir, nomor resi (dengan tombol salin), dan linimasa perjalanan paket (Jalur A) atau tautan "Lacak di situs kurir" (jalur cadangan).
- Data hanya muncul lewat pencarian yang sudah ada (no HP + Turnstile + rate limit). **Tidak ada endpoint publik baru** yang menerima resi bebas, supaya resi milik orang lain tidak bisa ditebak-tebak.
- Semua teks antarmuka lewat `locales/id.json` dan `locales/en.json`. Isi riwayat dari kurir ditampilkan apa adanya.

### 22.4 Integrasi api.co.id (server-only, Jalur A)
- `lib/tracking.ts`, tidak boleh diimpor komponen klien: `GET https://use.api.co.id/courier/v1/orders/track/{encodeURIComponent(waybill)}` dengan header `x-api-co-id: process.env.API_CO_ID_KEY` (env server, **bukan** `NEXT_PUBLIC_`), timeout 8 detik lewat `AbortController`.
- Tulis normalizer berdasarkan **respons asli dari 22.0**; jangan menebak nama field. Bentuk hasil: `{ status, delivered: boolean, events: [{ time, description, location }] }`. Simpan hasil ternormalisasi ke `tracking_summary`, bukan payload mentah.
- **Cache:** panggil API hanya bila pesanan berstatus `Dikirim`, punya resi, dan `tracking_checked_at` lebih lama dari 30 menit. Selain itu pakai cache. Bila API gagal atau timeout, tampilkan cache terakhir dengan keterangan "terakhir diperbarui …"; halaman tidak boleh error.
- Webhook api.co.id (`order.shipping`, `order.delivered`, dst.) hanya berlaku untuk pengiriman yang dibuat lewat API mereka, jadi tidak dipakai di Jalur A.
- Bila paket terdeteksi sudah diterima, tampilkan saran di admin: "Paket sudah diterima — tandai Selesai?". Status tetap diubah manual oleh admin.

### 22.5 Env & dokumen
- `.env.example`: tambah `API_CO_ID_KEY=` (kosong = tracking lewat API nonaktif, otomatis memakai jalur cadangan).
- PRD: tambah §3.10 "Lacak Pengiriman", dan tegaskan ongkir otomatis tetap di luar cakupan.
- `DEPLOYMENT.md`: env baru, dan pastikan server boleh request keluar ke `use.api.co.id`.

### 22.6 Review
`architect` (sebelum coding) → `code-reviewer` (Skill 20) → `security-auditor` (Skill 21). Fokus keamanan: API key tidak bocor ke klien, resi di-encode di URL, dan tidak ada cara melihat resi milik pelanggan lain.

**Acceptance Criteria:**
- [ ] 22.0 sudah terisi dan jalurnya (A / B / cadangan) diputuskan sebelum coding
- [ ] Admin bisa menyimpan kurir dan resi; format yang salah ditolak
- [ ] Pelanggan melihat resi dan linimasa (Jalur A) atau tautan lacak kurir (cadangan), hanya untuk pesanannya sendiri
- [ ] API dipanggil paling banyak 1× per 30 menit per pesanan; API mati tidak membuat halaman Cek Pesanan error
- [ ] `API_CO_ID_KEY` tidak muncul di bundle klien (`grep -r API_CO_ID .next/static` kosong)
- [ ] Status pesanan tetap manual dan alur ongkir tidak berubah

---

# BAGIAN E — Migrasi Infrastruktur ke Cloudflare Workers (Skill 23–30)

Migrasi dari cPanel (Passenger + MySQL + disk lokal) ke Cloudflare Workers. **Keputusan yang sudah diambil (13 Okt 2026):**

- **Database:** Cloudflare **D1** (SQLite via binding) — BUKAN Hyperdrive + MySQL eksternal.
- **Upload foto:** Cloudflare **R2** — bukan filesystem lokal.
- **Captcha:** **Cloudflare Turnstile** — sekaligus menutup backlog Skill 15 (dokumen sudah Turnstile, kode masih reCAPTCHA).
- **Paket:** Workers **Free** (10 ms CPU/request, 100 rb request/hari) — konsekuensi: hashing password memakai **PBKDF2 Web Crypto** (scrypt terlalu berat untuk batas CPU ini).

**Prinsip selama migrasi:**

- Aturan bisnis (`CLAUDE.md` §6) dan PRD **tidak berubah** — yang berubah hanya infrastruktur.
- `CLAUDE.md` §2 wajib diperbarui di Skill 23; kalau tidak, agent berikutnya akan menolak perubahan Workers karena aturan lama "deployment cPanel".
- Tiap skill tetap mengikuti "Alur Kerja Setiap Skill" (architect bila mengubah skema/integrasi → implementasi → `tsc` + build → code-reviewer → security-auditor → commit).
- Urutan eksekusi: **23 → 24 → 26 → 28 → 27 → 25 → 29 → 30** (26 sebelum 28 karena rate limit butuh skema dari 24; 27 sesudah 26 karena upload route memakai auth baru).
- Selama Skill 23–29 situs production **tetap berjalan di cPanel**; cutover hanya di Skill 30.
- Skill 22 (tracking resi) dikerjakan **setelah** migrasi, langsung di atas D1.

---

## Skill 23 — Setup Runtime Cloudflare Workers

**Tujuan:** Aplikasi Next.js bisa di-build dan dijalankan di Workers (via `@opennextjs/cloudflare`) tanpa mengubah perilaku; DB dan upload sementara masih menunjuk backend lama.

**Langkah:**

1. **Perbarui `CLAUDE.md` §2 terlebih dahulu:** deployment target → Cloudflare Workers (OpenNext + `nodejs_compat`); database → D1; upload foto → R2. Hapus sub-bab "Batasan Deployment cPanel", ganti dengan batasan Workers: tanpa filesystem persisten, tanpa koneksi TCP langsung, batas CPU free tier 10 ms/request, konfigurasi runtime via binding (`wrangler.jsonc`) + secrets (bukan `.env` di server).
2. Install dev dependency: `npm i -D @opennextjs/cloudflare wrangler`.
3. Buat `wrangler.jsonc`: name `rasa-medan`, `compatibility_date` terkini, `compatibility_flags: ["nodejs_compat"]`, binding assets, serta placeholder binding `DB` (D1) dan `UPLOADS` (R2) — ID asli diisi di Skill 24/27.
4. Buat `open-next.config.ts` (konfigurasi default).
5. Hapus `server.js`. Update `package.json`: `preview` = `opennextjs-cloudflare build && wrangler dev`, `deploy` = `opennextjs-cloudflare build && wrangler deploy`. Script `dev`/`build` tetap.
6. `.gitignore`: tambahkan `.open-next/`, `.wrangler/`, `.dev.vars`. Buat `.dev.vars.example` (template secret lokal).
7. **Pemilik:** buat akun Cloudflare, pindahkan nameserver `rasamedan.com` ke Cloudflare, jalankan `npx wrangler login`.
8. Deploy uji ke `rasa-medan.workers.dev`; pastikan semua halaman publik ter-render (katalog masih membaca MySQL lokal dan bisa jatuh ke fallback dummy — catat risiko ini di review).

**Acceptance Criteria:**

- [ ] `npm run build` dan `npx opennextjs-cloudflare build` lolos tanpa error
- [ ] Semua halaman publik render di `*.workers.dev` (cart, toggle bahasa, link WhatsApp berfungsi)
- [ ] `server.js` terhapus; tidak ada referensi Passenger tersisa di kode
- [ ] `CLAUDE.md` §2 sudah berbunyi Workers (bukan cPanel)
- [ ] Review `code-reviewer` (Skill 20.1) bersih dari temuan Kritis/Penting

---

## Skill 24 — Migrasi Database: MySQL → D1

**Tujuan:** Seluruh lapisan data berjalan di atas D1 (SQLite via binding); `mysql2` dan connection pool dihapus total.

**Langkah:**

1. Buat `migrations/0001_init.sql` (dialek SQLite): `ENUM(...)` → `TEXT CHECK (col IN (...))`; `AUTO_INCREMENT` → `INTEGER PRIMARY KEY AUTOINCREMENT`; `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` → `TEXT DEFAULT (datetime('now'))`; `updated_at ON UPDATE` → `CREATE TRIGGER`; `TINYINT(1)` → `INTEGER`; buang `ENGINE/CHARSET`; FK tetap (`ON DELETE CASCADE/SET NULL`); index via `CREATE INDEX`. Sertakan tabel `login_failures(ip TEXT, ts INTEGER)` untuk Skill 28 dan kolom `admin_users.session_version INTEGER NOT NULL DEFAULT 0` untuk Skill 26.
2. Rewrite `lib/db.ts`: helper `query<T>(sql, params)` → `env.DB.prepare(sql).bind(...params).all()`; `execute()` → `.run()` (baca `meta.last_row_id`, `meta.changes`); helper `batch()` untuk operasi atomik. Akses binding via `getCloudflareContext()` dari `@opennextjs/cloudflare`, plus `initOpenNextCloudflareForLocal()` di `next.config.mjs` agar `next dev` tetap jalan dengan D1 lokal.
3. Adaptasi semua call site: `lib/products.ts`, `lib/categories.ts`, `lib/orders-db.ts` (perluas `IN (?)` menjadi satu placeholder per elemen), `lib/product-admin.ts` (`replaceVariants` → `batch()`), dan semua route di `app/api/**`: ganti `beginTransaction/commit/rollback` dengan `batch()` (insert order + items tetap atomik), `insertId` → `meta.last_row_id`, `affectedRows` → `meta.changes`, hapus tipe `RowDataPacket`.
4. Hapus dependensi `mysql2` dari `package.json`.
5. Generate tipe binding: `npx wrangler types` → referensikan di `cloudflare-env.d.ts`.
6. **Pemilik:** `npx wrangler d1 create rasamedan` lalu salin `database_id` ke `wrangler.jsonc`; jalankan migrasi lokal: `npx wrangler d1 migrations apply rasamedan --local`.

**Acceptance Criteria:**

- [ ] `npx tsc --noEmit` dan `npm run build` lolos
- [ ] Katalog, detail produk, checkout (order + items tersimpan atomik), cek pesanan, dan CRUD admin berfungsi di D1 lokal
- [ ] Tidak ada string `mysql` di `lib/` dan `app/`; `mysql2` hilang dari `package.json`
- [ ] Review `code-reviewer` bersih; `security-auditor` memeriksa ulang semua query (parameterized, tanpa injection)

---

### 24a — Catatan pelaksanaan (14 Okt 2026)

- **Skema:** `migrations/0001_init.sql` sesuai langkah 1, ditambah: waktu = teks ISO-8601 UTC (`strftime('%Y-%m-%dT%H:%M:%SZ','now')`, bisa langsung `new Date()`); `COLLATE NOCASE` pada username, slug, kategori, nama, `order_code` (paritas collation `utf8mb4_general_ci` MySQL: login "ADMIN" = "admin", cek Order ID huruf kecil tetap cocok); CHECK untuk enum, boolean, dan angka non-negatif; trigger `updated_at`. Kategori awal (kue/kering/sirup) ikut di 0001. Tabel rate limit bernama `login_failures(bucket TEXT, ts INTEGER)` — `bucket` = kunci rate limit (mis. `login:<ip>`, `checkorder:<ip>`), bukan IP mentah, karena dipakai untuk login **dan** cek pesanan/checkout (Skill 28).
- **`lib/db.ts`:** `query`, `queryIn` (memecah `IN` per 90 id — D1 menolak >100 parameter per query; teruji katalog 150 produk), `execute` (`changes`/`lastRowId`), `statement` + `batch` (atomik), `isUniqueViolation`, `dbErrorMessage` (log ringkas tanpa parameter).
- **Atomik:** checkout = 1 `batch` berisi **2 statement** berapa pun jumlah baris: INSERT order, lalu INSERT item via `json_each(?)` dari JSON yang dibangun server (paket Free D1 membatasi 50 query per invocation Worker; 1 INSERT per item akan gagal untuk keranjang besar). Jumlah item tersimpan diverifikasi; retry nomor urut (maks 5) saat UNIQUE bentrok; nomor urut berikutnya = `MAX(CAST(substr(...)))` (benar juga di atas 9999). Produk baru/ubah = 1 `batch` (produk + hapus/isi varian). Teruji: item gagal CHECK → order ikut batal.
- **`next dev`:** `initOpenNextCloudflareForDev()` di `next.config.mjs` (hanya NODE_ENV=development); `next dev` dan `npm run preview` berbagi D1 lokal `.wrangler/state`.
- **Tipe:** `npm run cf:typegen` = `wrangler types --include-runtime=false` (+ nama secret dari `.dev.vars.example`), ditambah `types/cloudflare-runtime.d.ts` (subset D1). Runtime types lengkap sengaja tidak dipakai: menimpa tipe DOM (`Response.json()` → `unknown`) sehingga komponen client gagal type-check.
- **`wrangler.jsonc`:** binding `DB` aktif dengan `database_id` placeholder (nol semua) — cukup untuk lokal; `scripts/check-deploy-env.mjs` menolak deploy sampai diganti id asli.
- **Skrip:** `seed`/`seed:admin` ditulis ulang via `wrangler d1 execute` (`scripts/lib/d1.mjs`; default lokal, `--remote` eksplisit). Skrip khusus MySQL dihapus (`test-db`, `apply-schema`, `migrate-add-weight`, `migrate-session-version`, `repair-order-items`, `seed-categories`); `db/schema.sql` diarsip ke `docs/legacy/schema-mysql.sql`. `@opennextjs/cloudflare` dipindah ke `dependencies` (dipakai runtime oleh `lib/db.ts`).
- **Perilaku baru kecil:** kata kunci pencarian pesanan admin disaring ke huruf/angka/"-" dan maks 24 karakter (D1 menolak pola LIKE >50 byte; wildcard `%`/`_` tidak bisa dipakai); PUT produk yang id-nya tidak ada → 404 (dulu 500, juga bila terhapus bersamaan); `npm run seed` ke `--remote` ditolak (data dummy hanya lokal); log error DB disaring (`dbErrorMessage` membuang nilai dari `D1_TYPE_ERROR`); id route admin wajib bilangan bulat > 0; nama kategori ≤100 saat rename.
- **Belum bisa diuji lokal (cek saat deploy uji workers.dev):** batas D1 remote yang tidak ditegakkan miniflare — 50 query/invocation (checkout 50 baris), pola LIKE ≤50 byte (pencarian admin). Timing login username tak dikenal (tanpa hashing) dicatat untuk Skill 26.; urutan tie-break `id DESC` pada daftar pesanan.

## Skill 25 — Migrasi Data & Seed

> **Catatan dari Skill 24:** `mysql2` sudah dihapus dari `package.json`. Untuk `scripts/export-mysql.mjs` (langkah 1) pasang sementara tanpa menyimpan (`npm i --no-save mysql2`) atau ekspor via phpMyAdmin/`mysqldump` lalu konversi. Kategori awal sudah ada di `0001_init.sql` (pakai `INSERT OR IGNORE` agar impor data production tidak bentrok). `npm run seed`/`seed:admin` sudah memakai D1 (langkah 2–3 sebagian selesai). Kolom waktu wajib dikonversi ke format `YYYY-MM-DDTHH:MM:SSZ` (UTC) — timestamp MySQL lama tersimpan dalam zona waktu server cPanel, jadi konversi ke UTC harus memakai zona itu.

**Tujuan:** Data production dari MySQL berpindah utuh ke D1; data dummy bisa di-seed ulang tanpa script Node.

**Langkah:**

1. Buat `scripts/export-mysql.mjs`: dump `categories`, `products`, `product_variants`, `admin_users` (dan `orders` + `order_items` bila production sudah berisi) menjadi satu file SQL dialek SQLite (escape string dengan benar, boolean → 0/1, timestamp → string ISO).
2. Konversi `scripts/seed*.mjs` menjadi file migrasi (`migrations/0002_seed_categories.sql`, dst.) yang dibangkitkan dari `data/dummy-products.json`.
3. `package.json`: `db:migrate` = `wrangler d1 migrations apply rasamedan --local` / `--remote`; `db:export` = script langkah 1. Hapus script `mysql2` lama yang sudah tidak dipakai.
4. Uji import ke D1 lokal; verifikasi jumlah baris per tabel sama dengan sumber dan `order_code` tetap unik.
5. **Catatan password admin:** hash lama berformat scrypt tidak kompatibel dengan PBKDF2 (Skill 26) dan tidak bisa di-rehash tanpa plaintext. Langkah migrasi data wajib menyertakan reset password admin (pemilik memilih password baru, dibuat lewat seed-admin versi Skill 26).

**Acceptance Criteria:**

- [ ] Data production terimport utuh (jumlah baris per tabel cocok)
- [ ] Produk lama tetap tampil di katalog; pesanan lama tetap bisa dicek via nomor HP
- [ ] Seed dummy bisa dijalankan ulang via `wrangler d1 execute --file` tanpa error
- [ ] Ada catatan jelas langkah reset password admin saat cutover

---

## Skill 26 — Rewrite Auth untuk Workers

> **Sudah dikerjakan di Skill 21 (13 Okt 2026):** langkah 2 bagian `session_version` (payload `ver`, cek di `getAdminSession()`, naik saat ganti password), langkah 3 (fallback secret dihapus), dan langkah 6 (`lib/client-ip.ts` memakai `cf-connecting-ip`). Sisa skill ini: PBKDF2 Web Crypto + HMAC via `crypto.subtle`, seed-admin versi D1.

**Tujuan:** Auth admin berjalan dalam batas CPU Workers Free, tanpa `node:crypto` scrypt — sekaligus menutup temuan Skill 21.2 no. 2, 4, dan 5.

**Langkah:**

1. Rewrite `lib/auth.ts` menjadi async penuh: `hashPassword`/`verifyPassword` memakai **PBKDF2-SHA256** via `crypto.subtle.deriveBits` (iterasi default 100.000; bila login kena batas CPU free tier, turunkan ke ±30.000 dan catat keputusannya di komentar); format tersimpan `pbkdf2:iter:salt:hash`; verifikasi memakai perbandingan XOR konstan-waktu.
2. Token sesi: HMAC-SHA256 via `crypto.subtle` (sign/verify async); sertakan `session_version` dari `admin_users` ke payload dan cocokkan di `getAdminSession()`; naikkan nilainya saat password diganti (menutup 21.2 no. 5 — sesi perangkat lain ikut tercabut).
3. **Hapus fallback** `"dev-insecure-secret-change-me"` (21.2 no. 2): tanpa `ADMIN_SESSION_SECRET` ≥ 32 karakter di production, login ditolak.
4. Update semua call site sync → async: `app/api/admin/auth`, `app/api/admin/account`, `app/api/admin/upload`, `app/admin/(protected)/layout.tsx`, `app/admin/login/page.tsx`.
5. `scripts/seed-admin` versi baru: hashing via Web Crypto di Node lokal, menghasilkan SQL `INSERT` untuk D1 (dipakai juga untuk reset password di Skill 25).
6. Sumber IP untuk rate limit: gunakan header `cf-connecting-ip` (diisi Cloudflare, tidak bisa dipalsukan klien) — menutup 21.2 no. 4.

**Acceptance Criteria:**

- [ ] Login, logout, dan ganti password berfungsi; setelah ganti password semua sesi lain tercabut
- [ ] Tanpa secret (atau secret < 32 karakter) di production, login ditolak — bukan memakai default
- [ ] Password baru di DB berformat `pbkdf2:...` (bukan scrypt)
- [ ] `security-auditor` (Skill 21.1) bersih dari temuan Kritis/Tinggi

---

### 26a — Catatan pelaksanaan (14 Okt 2026)

- **`lib/password.mjs`** (JS murni Web Crypto, dipakai aplikasi DAN `scripts/seed-admin.mjs` — satu sumber format): PBKDF2-SHA256, salt 16 byte, hash 32 byte, format `pbkdf2:<iter>:<saltHex>:<hashHex>`, perbandingan XOR waktu-konstan. Iterasi tersimpan di hash; iterasi di luar 1–100.000 (batas PBKDF2 Workers) atau format lain ditolak.
- **Iterasi = 30.000**, bukan 100.000: terukur ±5,4 ms vs ±16 ms per hash (melewati 10 ms CPU Free). Kompensasi: Turnstile + rate limit login, password baru minimal **12** karakter (halaman Pengaturan, semula 8; sama dengan `seed:admin`). Bila pindah paket berbayar, naikkan `PBKDF2_ITERATIONS` — hash lama di-upgrade otomatis saat login (`needsRehash`, tanpa menaikkan `session_version`). Catatan: login yang memicu upgrade menjalankan PBKDF2 dua kali (±2× CPU) — sekali per admin per kenaikan iterasi; naikkan iterasi bersamaan dengan pindah ke paket berbayar.
- **`lib/auth.ts`** async penuh tanpa `node:crypto`: token `payload.sig` base64url, HMAC-SHA256 `crypto.subtle.sign/verify` (verify waktu-konstan), CryptoKey di-cache per nilai secret (dibuat lazy di request); token >1 KB / bagian ekstra ditolak; secret tidak valid di production → `getAdminSession` null dan login 500 (fail-closed).
- **Anti-enumerasi timing:** username tak dikenal tetap menjalankan PBKDF2 terhadap hash dummy (`verifyLogin`) — terukur ±28 ms keduanya (menutup catatan audit Skill 24). Berlaku juga untuk akun dengan hash tak dikenali (scrypt lama) — tetap di-hash dummy.
- **Hash scrypt era cPanel ditolak** (tanpa fallback scrypt): login gagal + log petunjuk `npm run seed:admin -- --reset`. Konsekuensi untuk Skill 25/30: password admin dibuat ulang saat cutover (sudah direncanakan di Skill 25 langkah 5).
- **Teruji:** unit test format/verify/salah/salt unik/hash lama/iterasi tak wajar/upgrade; 6 jenis token palsu ditolak; upgrade hash 1.000 → 30.000 saat login tanpa memutus sesi; password baru 11 karakter ditolak; E2E 54 skenario lolos di `next dev` dan preview workerd; preview dengan secret pendek → login 500.
- **Dari audit:** upgrade hash saat login memakai compare-and-swap (`WHERE password_hash = <hash yang dibaca>`) agar login dengan password lama tidak bisa menimpa password yang baru diganti; iterasi di hash wajib angka desimal 1–6 digit; tebakan "password saat ini" di Pengaturan dibatasi 5 salah / 15 menit per akun (in-memory seperti login — pindah ke D1 di Skill 28).
- **Wajib diuji di workers.dev (Skill 29/30):** ganti password = 2× PBKDF2 (±10 ms CPU, pas di batas Free); bila sering "Exceeded CPU", turunkan iterasi sedikit (mis. 25.000) atau terima dan catat. Risiko diterima: bila isi D1 bocor, cracking offline lebih murah dari rekomendasi OWASP (600k) — pertahanannya password admin ≥12 karakter acak.
- `package.json` `engines.node >=20` (`crypto` global dipakai `lib/password.mjs` di skrip Node).
- Sisa `node:crypto`: hanya `randomBytes` untuk nama file di `app/api/admin/upload/route.ts` (murah; route ini ditulis ulang di Skill 27).

## Skill 27 — Upload Foto: Disk → R2

> **Sudah dikerjakan di Skill 21:** validasi magic bytes (`lib/image-type.ts`, portabel). Sisa skill ini: penyimpanan R2 + route GET `/uploads/[...path]`.

**Tujuan:** Foto produk disimpan di R2 (persisten), bukan di filesystem — sekaligus menutup temuan Skill 21.2 no. 6 (validasi magic bytes).

**Langkah:**

1. **Pemilik:** buat R2 bucket `rasa-medan-uploads`; isi binding `UPLOADS` di `wrangler.jsonc`.
2. Rewrite `app/api/admin/upload/route.ts`: validasi **magic bytes** (JPEG/PNG/WEBP/GIF — jangan percaya `file.type`) + ukuran maks 2 MB; simpan via `env.UPLOADS.put("uploads/<nama-file>", bytes)`; kolom `products.image` tetap menyimpan path `/uploads/<nama-file>` seperti sekarang.
3. Route baru `app/uploads/[...path]/route.ts` (GET publik, header cache `immutable`) melayani objek dari R2 — path lama `/uploads/x.jpg` tidak berubah sehingga **tidak perlu migrasi data** kolom `image`.
4. Migrasi file: unggah seluruh isi `public/uploads/` ke R2 (`wrangler r2 object put` per file atau skrip kecil).
5. Putuskan perilaku dev lokal (tulis ke disk lokal seperti sekarang, atau wajib R2 lokal via miniflare) dan dokumentasikan di `README.md`.
6. (Opsional, fase lanjut) custom domain `cdn.rasamedan.com` untuk bucket agar penyajian gambar tidak memakan kuota request Workers.

**Acceptance Criteria:**

- [ ] Upload dari dashboard menampilkan foto baru lewat URL `/uploads/...` yang dilayani R2
- [ ] Semua foto produk lama tetap tampil
- [ ] File non-gambar ditolak walau `file.type` dimanipulasi (magic bytes diperiksa)
- [ ] Tidak ada `node:fs` tersisa di `app/api/`

---

## Skill 28 — Turnstile & Rate Limit di D1

> **Sudah dikerjakan di Skill 21:** langkah 1, 2, dan 4 (Turnstile di login, cek pesanan, checkout; batas input/item; rate limit checkout). Sisa skill ini: langkah 3 — rate limit pindah dari memori ke tabel D1 `login_failures`. Kunci yang wajib ikut dipindah: `login:*`, `checkorder:*`, `order:*`, `ordercaptcha:*`, dan `account:*` (tebakan password saat ini di Pengaturan, Skill 26).

**Tujuan:** Menutup backlog Skill 15 (kode masih reCAPTCHA) dan menyelesaikan hardening checkout (Skill 21.2 no. 3) di atas infrastruktur Cloudflare.

**Langkah:**

1. Ganti `lib/recaptcha.ts` → `lib/turnstile.ts`: verifikasi server ke `https://challenges.cloudflare.com/turnstile/v0/siteverify` memakai secret dari binding/env; IP client dari `cf-connecting-ip`.
2. `components/admin/LoginForm.tsx` + `app/admin/login/page.tsx`: ganti widget reCAPTCHA dengan Turnstile (`https://challenges.cloudflare.com/turnstile/v0/api.js`). Env `RECAPTCHA_*` dihapus, diganti `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`.
3. Rewrite `lib/rate-limit.ts` ke tabel `login_failures` (dari Skill 24) — pertahankan API `{limited, retryAfterSec}`; berlaku untuk login **dan** cek pesanan; tahan restart (tersimpan di D1, bukan memori).
4. Checkout `POST /api/orders`: tambahkan verifikasi Turnstile, rate limit 10 pesanan/jam/IP, batas panjang input (nama ≤100, alamat ≤500, catatan ≤500 karakter) dan batas isi (≤50 baris item, qty ≤99 per baris) — sesuai 21.2 no. 3.
5. **Pemilik:** daftarkan site key Turnstile untuk domain `rasamedan.com` di dashboard Cloudflare.
6. Perbarui tabel status baris Skill 15 setelah skill ini selesai.

**Acceptance Criteria:**

- [ ] Login, cek pesanan, dan checkout menolak token kosong saat Turnstile dikonfigurasi; verifikasi dilakukan di server
- [ ] Lockout setelah 5 kegagalan/15 menit tetap bekerja setelah restart Worker
- [ ] Checkout palsu tanpa token ditolak; batas input & item ditegakkan
- [ ] Tidak ada referensi `recaptcha` tersisa di kode
- [ ] `security-auditor` bersih

---

## Skill 29 — Environment, Config & Build CI

**Tujuan:** Konfigurasi production rapi (vars vs secrets), deploy otomatis dari GitHub, dan dokumentasi deploy akurat — menutup temuan Skill 21.2 no. 1.

**Langkah:**

1. Pisahkan konfigurasi: `NEXT_PUBLIC_*` di `vars` pada `wrangler.jsonc` (di-inline **saat build** — wajib diisi sebelum `opennextjs-cloudflare build`); secrets (`ADMIN_SESSION_SECRET`, `TURNSTILE_SECRET_KEY`, dan `API_CO_ID_KEY` untuk Skill 22 nanti) via `wrangler secret put`.
2. Tulis ulang `.env.example`: hapus `DB_*` MySQL dan `RECAPTCHA_*`; tambah `TURNSTILE_*`; beri catatan bahwa konfigurasi production hidup di wrangler/dashboard, bukan `.env` server.
3. **Rotasi `ADMIN_SESSION_SECRET`** (21.2 no. 1 — nilai lama pernah ter-commit di riwayat git): generate baru (`openssl rand -hex 32`), pasang via `wrangler secret put`, dan ganti nilai di `.env.example` menjadi placeholder.
4. Aktifkan **Workers Builds** (integrasi GitHub: push ke `main` → build + deploy otomatis), atau bila tidak tersedia, dokumentasikan deploy manual `npm run deploy`.
5. Tulis ulang `DEPLOYMENT.md` untuk Cloudflare; pindahkan versi cPanel ke `docs/legacy/DEPLOYMENT-cpanel.md`.
6. Update `README.md` §2 (tech stack) dan §8 (deploy) sesuai kondisi baru.
7. Sesuaikan checklist Skill 21.3 untuk Cloudflare (SSL otomatis, uploads di R2, tanpa `.htaccess`).

**Acceptance Criteria:**

- [ ] Push ke `main` menghasilkan deploy otomatis yang sukses (atau prosedur manual terdokumentasi dan teruji)
- [ ] Tidak ada kredensial/secret di repo; `ADMIN_SESSION_SECRET` sudah dirotasi
- [ ] `DEPLOYMENT.md` akurat untuk Cloudflare; versi cPanel terarsip
- [ ] `code-reviewer` bersih

---

## Skill 30 — Cutover & Pensiun cPanel

**Tujuan:** Domain asli dilayani Cloudflare Workers dan cPanel dinonaktifkan dengan aman. **GERBANG:** hanya dikerjakan setelah Skill 23–29 selesai dan situs stabil di `*.workers.dev` minimal 48 jam.

**Langkah:**

1. Bekukan perubahan di cPanel (minta pemilik tidak mengubah produk/pesanan selama cutover).
2. Import data final (Skill 25) ke D1 **remote**; verifikasi jumlah baris dan sampel pesanan terbaru.
3. Upload final `public/uploads/` → R2 (selisih file sejak Skill 27).
4. Pasang custom domain `rasamedan.com` + `www` ke Worker (DNS sudah di Cloudflare sejak Skill 23); pastikan SSL otomatis aktif.
5. Uji end-to-end di domain asli: checkout sampai pesan WhatsApp terbentuk, cek pesanan, login admin, ubah status pesanan, upload foto produk.
6. Observasi 48 jam (Workers analytics + logs). Bila ada masalah besar → kembalikan DNS ke cPanel (rollback terdokumentasi).
7. Setelah stabil: hentikan Node.js App di cPanel. **Jangan hapus DB MySQL sebelum 30 hari** (cadangan rollback). Jadwalkan backup D1 berkala (`wrangler d1 export` / Time Travel).
8. Perbarui tabel status di file ini; perbarui PRD §5.1 (tech stack) bila perlu; tandai backlog Skill 15, 21.2 no. 1–6 yang sudah tertutup.

**Acceptance Criteria:**

- [ ] `rasamedan.com` dilayani dari Workers dengan SSL aktif
- [ ] Seluruh alur bisnis (PRD §2) berjalan utuh di domain asli
- [ ] Prosedur rollback teruji (DNS bisa dikembalikan ke cPanel)
- [ ] cPanel dinonaktifkan; DB MySQL lama diarsipkan, bukan dihapus
- [ ] Tabel status diperbarui (Skill 23–30 ✅; Skill 15 dan temuan 21.2 terkait ditutup)

---

*Skill baru berikutnya ditambahkan di file ini dengan nomor lanjutan (Skill 31, dst.), memakai format yang sama: Tujuan, langkah, Acceptance Criteria.*
