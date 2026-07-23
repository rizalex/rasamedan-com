# DEPLOYMENT.md
## Panduan Deploy "Rasa Medan" ke cPanel (Node.js App / Passenger)

Stack: Next.js (App Router) + MySQL. Semua dependency pure-JS (mysql2) atau
bawaan Node (crypto) — **tidak ada native binary yang perlu di-compile** di
shared hosting. Optimasi gambar Next dimatikan (tanpa `sharp`).

---

## 1. Prasyarat di cPanel
- Menu **"Setup Node.js App"** tersedia (Phusion Passenger). Jika tidak ada,
  minta provider mengaktifkannya.
- Node.js **18+** (project diuji di Node 20/22/25). Next 15 butuh Node ≥ 18.18.
- Akses **MySQL Databases** dan **phpMyAdmin**.

---

## 2. Setup Database MySQL
1. Buat database baru via **MySQL Databases** (mis. `namauser_rasamedan`).
2. Buat user MySQL, assign ke database dengan **ALL PRIVILEGES**.
3. Import schema tabel via **phpMyAdmin → Import**, pilih file **`db/schema.sql`**
   dari project ini. Ini membuat 5 tabel: `products`, `product_variants`,
   `orders`, `order_items`, `admin_users`.
   - Alternatif via SSH: `npm run db:schema` (butuh `.env` terisi).
4. (Opsional) Isi data awal produk: `npm run seed` — memasukkan 9 produk contoh
   dari `data/dummy-products.json`. Lewati jika ingin mulai dari kosong.
5. **Buat akun admin** (wajib, agar bisa login dashboard):
   `ADMIN_USERNAME=admin ADMIN_PASSWORD=passwordKuat npm run seed:admin`
   (default `admin` / `admin123` bila env tak diisi — **ganti sebelum go-live**).
6. Catat `DB_HOST` (biasanya `localhost`), `DB_USER`, `DB_PASS`, `DB_NAME`.

---

## 3. Environment Variables
Salin `.env.example` menjadi `.env` dan isi (atau masukkan langsung ke panel
**Environment Variables** cPanel — JANGAN commit/upload `.env` berisi kredensial):

| Variable | Keterangan |
|---|---|
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASS` `DB_NAME` | Kredensial MySQL dari langkah 2 |
| `NEXT_PUBLIC_WA_NUMBER` | Nomor WA UTAMA (khusus pemesanan), format internasional tanpa `+` (mis. `6281234567890`) |
| `NEXT_PUBLIC_WA_NUMBER_ALT` | Nomor WA ALTERNATIF untuk layanan pelanggan/pertanyaan umum (opsional; kosongkan bila tak dipakai) |
| `ADMIN_SESSION_SECRET` | String acak panjang (mis. hasil `openssl rand -hex 32`) |
| `RECAPTCHA_SITE_KEY` `RECAPTCHA_SECRET_KEY` | Kunci Google reCAPTCHA v2 checkbox (daftar di https://www.google.com/recaptcha/admin). Isi **keduanya** untuk mengaktifkan proteksi login admin; kosongkan keduanya untuk menonaktifkan. |
| `NODE_ENV` | `production` |

> **Keamanan login admin (Skill 15):** reCAPTCHA aktif otomatis bila kedua key di
> atas diisi. Tanpa key, form login tetap berfungsi tanpa reCAPTCHA. Login juga
> dibatasi rate-limit (maks 5 gagal / 15 menit per IP → terkunci sementara), dan
> cookie sesi memakai `httpOnly` + `sameSite=strict` + `secure` (butuh HTTPS).

---

## 4. Build Aplikasi
Disarankan build **lokal** lalu upload folder `.next` (lebih ringan untuk shared
hosting), atau build di server bila ada akses SSH:

```bash
npm install
npm run build
```

---

## 5. Upload ke Server
- Upload seluruh project **kecuali** `node_modules` (dan `.env` asli).
- Jika build dilakukan lokal, **ikutkan folder `.next`**.
- Pastikan folder **`public/uploads`** ada dan **writable** (foto produk admin
  disimpan di sini). Set permission `755` (atau `775`) bila perlu.

---

## 6. Setup Node.js App di cPanel
1. **Setup Node.js App → Create Application**.
2. **Application root**: folder project.
3. **Application startup file**: **`server.js`** (custom server Next yang listen
   di `process.env.PORT` dari Passenger).
4. **Node.js version**: 18+.
5. Isi semua **Environment Variables** (lihat bagian 3).
6. Klik **Run NPM Install**.
7. Bila `.next` belum diupload, jalankan build via terminal cPanel: `npm run build`.
8. Klik **Restart**.

> Menjalankan manual (mis. saat tes SSH): `npm run build && npm start`
> (`npm start` = `next start`). Passenger sendiri memakai `server.js`.

---

## 7. Domain & SSL
- Arahkan domain/subdomain ke aplikasi via panel Setup Node.js App.
- Aktifkan SSL (Let's Encrypt) di menu **SSL/TLS Status**. Karena cookie sesi
  admin memakai flag `secure` di production, HTTPS wajib agar login admin jalan.

---

## 8. Checklist Sebelum Go-Live
- [ ] `NEXT_PUBLIC_WA_NUMBER` sudah nomor WA asli pemilik (bukan `62812...0000`)
- [ ] `ADMIN_SESSION_SECRET` diganti string acak kuat
- [ ] Password admin diganti (`seed:admin` dengan `ADMIN_PASSWORD` kuat)
- [ ] SSL/HTTPS aktif (wajib untuk cookie sesi admin `secure`)
- [ ] `public/uploads` writable & foto produk tampil benar
- [ ] Test alur checkout penuh sampai membuka WhatsApp dengan pesan benar
- [ ] Test cek status pesanan pakai nomor HP
- [ ] Test login admin `/admin/login` + ubah status pesanan
- [ ] Backup database berkala (cPanel Cron/Backup)
