# ARSIP — Panduan Deploy cPanel (Node.js App / Passenger)

> **Arsip (Skill 29, 14 Okt 2026).** Tidak berlaku untuk `main`: aplikasi kini di Cloudflare Workers — lihat `DEPLOYMENT.md` di root. Dipertahankan hanya untuk hotfix darurat situs cPanel lama dari commit `fb4ea12` sampai cutover Skill 30.

> **Sejak Skill 24 (14 Okt 2026) `main` memakai Cloudflare D1, bukan MySQL:** `mysql2`, `db/schema.sql` (diarsip ke `docs/legacy/schema-mysql.sql`), dan skrip `db:test`/`db:schema`/`db:migrate:session`/`db:repair`/`seed:categories` sudah dihapus. Perintah MySQL di bawah hanya berlaku dari checkout `fb4ea12`. `npm run seed`/`seed:admin` di `main` kini menulis ke D1.
> **Jangan jalankan `main` (Skill 21 ke atas) di cPanel/`next start` publik:** IP klien hanya dipercaya dari edge Cloudflare (`TRUST_CF_CONNECTING_IP`), sehingga di luar Workers semua pengunjung berbagi satu ember rate limit (satu penyerang bisa mengunci login/cek pesanan untuk semua orang).

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
   dari project ini. Ini membuat 6 tabel: `categories` (sudah berisi
   Kue/Kering/Sirup), `products`, `product_variants`, `orders`, `order_items`,
   `admin_users`.
   - Alternatif via SSH: `npm run db:schema` (butuh `.env` terisi).
   - **DB lama (sebelum 13 Okt 2026):** jalankan `npm run db:migrate:session` —
     tanpa kolom `admin_users.session_version` login admin ditolak (fail-closed).
     Semua admin perlu login ulang sekali setelah update.
4. (Opsional) Isi data awal produk: `npm run seed` — memasukkan 9 produk contoh
   dari `data/dummy-products.json`. Lewati jika ingin mulai dari kosong.
   Seed menolak jalan bila tabel produk sudah berisi (cegah katalog asli terhapus);
   untuk menimpa dengan data dummy: `npm run seed -- --force`.
5. **Buat akun admin** (wajib, agar bisa login dashboard):
   `ADMIN_USERNAME=admin ADMIN_PASSWORD='<password-kuat-milik-sendiri>' npm run seed:admin`
   (jangan salin contoh apa adanya; awali perintah dengan spasi agar password
   tidak tersimpan di riwayat shell bila `HISTCONTROL=ignorespace`)
   (`ADMIN_PASSWORD` wajib, minimal 12 karakter — tidak ada password default).
   Akun yang sudah ada tidak ditimpa; reset password sengaja:
   `ADMIN_PASSWORD=... npm run seed:admin -- --reset`.
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
| `ADMIN_SESSION_SECRET` | String acak panjang (mis. hasil `openssl rand -hex 32`). **Wajib dirotasi** — nilai lama pernah ter-commit (Skill 21.2 no. 1). Ganti di SEMUA lokasi: (1) panel Node.js App cPanel yang masih live lalu restart, (2) `npx wrangler secret put ADMIN_SESSION_SECRET` untuk Workers, (3) `.env` lokal. Nilai yang bocor ditolak aplikasi versi baru, tetapi kode lama di cPanel masih menerimanya. |
| `TURNSTILE_SITE_KEY` `TURNSTILE_SECRET_KEY` | Kunci Cloudflare Turnstile (dash.cloudflare.com → Turnstile → Add widget, mode *Managed*; hostname = domain production, plus `*.workers.dev` bila dipakai untuk staging). **Wajib di production** — tanpa secret, login/cek pesanan/checkout ditolak. Test key `1x…` ditolak di production (kecuali `ALLOW_TEST_CAPTCHA=1` di `.dev.vars` untuk preview lokal — jangan pernah di Workers). Key asli butuh `NEXT_PUBLIC_SITE_URL` https yang benar saat build. |
| `NODE_ENV` | `production` |

> **Keamanan (Skill 15 & 21):** Turnstile wajib di production untuk login admin,
> cek pesanan, dan checkout (fail-closed). Server juga memastikan hostname token
> sama dengan `NEXT_PUBLIC_SITE_URL` — build staging workers.dev harus memakai URL
> workers.dev itu. Login juga dibatasi rate-limit (maks 5 gagal / 15 menit per IP → terkunci sementara), dan
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
