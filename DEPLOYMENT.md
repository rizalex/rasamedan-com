# DEPLOYMENT.md
## Panduan Deploy "Rasa Medan" ke Cloudflare Workers

Aplikasi berjalan di **Cloudflare Workers** (paket Free) lewat `@opennextjs/cloudflare`:
database **D1**, foto produk **R2**, captcha **Turnstile**. Panduan cPanel lama
diarsip di [`docs/legacy/DEPLOYMENT-cpanel.md`](docs/legacy/DEPLOYMENT-cpanel.md)
(hanya untuk hotfix darurat dari commit `fb4ea12`).

> **Urutan besar:** §1–§9 menyiapkan dan menguji deploy di `*.workers.dev`
> (staging). Pindah domain `rasamedan.com` dari cPanel ke Cloudflare (impor data
> final, domain, rollback, pensiun cPanel) ada di **§11 Transisi dari cPanel**
> (Skill 30) — baca seluruhnya sebelum memulai.

---

## 0. Peta konfigurasi (di mana setiap nilai tinggal)

| Jenis | Contoh | Lokasi | Kapan dibaca |
|---|---|---|---|
| Publik, di-inline ke JS | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WA_NUMBER`, info toko | `.env` (deploy dari komputer) **atau** Build variables Workers Builds | **saat build** — ubah nilai = build & deploy ulang |
| Non-rahasia runtime | `TURNSTILE_SITE_KEY`, `TRUST_CF_CONNECTING_IP`, `SHIPPING_ORIGIN_DISTRICT_CODE`, `SHIPPING_RATES_DAILY_CAP` | `vars` di `wrangler.jsonc` (di-commit) | saat request |
| Rahasia runtime | `ADMIN_SESSION_SECRET`, `TURNSTILE_SECRET_KEY`, `API_CO_ID_KEY` (opsional, Skill 31) | `npx wrangler secret put <NAMA>` | saat request |
| Binding | D1 `DB`, R2 `UPLOADS` | `wrangler.jsonc` | saat request |
| Lokal saja | rahasia untuk `npm run preview` | `.dev.vars` (tidak di-commit) | preview lokal |

Catatan:
- `NEXT_PUBLIC_*` **tidak** ditaruh di `vars` wrangler: Next meng-inline-nya saat
  build, sehingga nilai runtime tidak berpengaruh (menyimpang dari teks Skill 29
  langkah 1 — dicatat di SKILLS 29a).
- `npm run cf:build` menyaring `.env` dari bundle: hanya `NEXT_PUBLIC_*`,
  `GOOGLE_SITE_VERIFICATION`, `NODE_ENV` yang ikut (`scripts/strip-bundle-secrets.mjs`).
  Rahasia di `.env` lokal tidak pernah ter-upload.
- Jangan pernah set `vars` lewat dashboard: `wrangler deploy` menimpanya dengan isi `wrangler.jsonc`.

---

## 1. Prasyarat (sekali)

1. Node.js **≥ 20.6**, lalu `npm install`.
2. Akun Cloudflare; login CLI: `npx wrangler login`.
3. (Untuk Skill 30) domain `rasamedan.com` sudah memakai nameserver Cloudflare.

## 2. Buat resource Cloudflare (sekali)

```bash
npx wrangler d1 create rasamedan
```
Salin `database_id` dari output ke `wrangler.jsonc` → `d1_databases[0].database_id`
(menggantikan placeholder `00000000-…`; `npm run deploy` menolak jalan sebelum diganti).

```bash
npx wrangler r2 bucket create rasa-medan-uploads
```
Bucket harus **privat**: di dashboard R2 → bucket → Settings, pastikan *Public
Development URL (r2.dev)* **Disabled** dan tidak ada custom domain. Foto disajikan
lewat route aplikasi `/uploads/...`.

**Turnstile:** dashboard → Turnstile → Add widget, mode *Managed*, hostname = domain
production (+ `<nama>.workers.dev` untuk staging). Isi **site key** ke
`wrangler.jsonc` → `vars.TURNSTILE_SITE_KEY` dan commit.

## 3. Rahasia (sekali, dan setiap rotasi)

> ⚠️ **PALING MENDESAK — situs cPanel yang masih live:** nilai `ADMIN_SESSION_SECRET`
> lama pernah ter-commit (tetap ada di riwayat git). Kode lama di cPanel **masih
> menerimanya** — siapa pun yang pernah/akan bisa membaca riwayat repo bisa memalsukan sesi admin
> cPanel. Ganti sekarang di panel *Setup Node.js App* cPanel (Environment variables →
> `ADMIN_SESSION_SECRET`) lalu **Restart**, dan ganti juga password admin cPanel.
> Nilai untuk cPanel (harus BERBEDA dari nilai Workers di bawah) — cetak sekali,
> tempel ke panel, lalu bersihkan layar (`cls`/`clear`) dan clipboard:
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
> Berlaku sampai cPanel dipensiunkan (Skill 30).

Buat secret sesi baru untuk Workers — **wajib nilai baru**, dialirkan langsung tanpa
ditampilkan di layar atau clipboard:
```bash
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" | npx wrangler secret put ADMIN_SESSION_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
```
(untuk Turnstile, tempel secret dari dashboard saat diminta; jangan menaruh rahasia di
file, argumen perintah, atau Build variables). Di Windows PowerShell 5.1 pipe bisa
menambah baris baru di akhir nilai — jalankan baris pertama dari Git Bash, atau pakai
prompt interaktif `npx wrangler secret put ADMIN_SESSION_SECRET` lalu tempel nilai
dari `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
(kosongkan clipboard sesudahnya).
Rotasi secret sesi = semua admin logout — aman dilakukan kapan saja.
Alternatif dashboard: Worker → Settings → Variables and Secrets → Add → tipe **Secret**.
Staging (§9a) memakai perintah yang sama + `--env staging` dengan nilai **berbeda**.
Bila Worker `rasa-medan` belum pernah di-deploy, `secret put` menawarkan membuat Worker
kosong — jawab **Y** (atau jalankan langkah ini setelah deploy pertama; sebelum secret
terpasang, login admin production menolak dengan error 500 — gagal tertutup).

## 4. Nilai build (`.env`)

Salin `.env.example` → `.env`, isi minimal:
- `NEXT_PUBLIC_SITE_URL` = URL https tempat situs akan diakses, tanpa trailing slash.
  Staging: `https://rasa-medan.<subdomain>.workers.dev`; production: `https://rasamedan.com`.
  Nilai ini juga dipakai cek hostname Turnstile — **harus cocok dengan URL deploy**.
  Pindah dari staging ke domain asli (cutover) = ganti nilai ini lalu `npm run deploy`
  ulang; tanpa build ulang, canonical/sitemap menunjuk workers.dev dan captcha menolak
  token dari domain asli.
- `NEXT_PUBLIC_WA_NUMBER` (nomor WA asli pemilik, format `628…`), info toko & sosial.
- `GOOGLE_SITE_VERIFICATION` (opsional).

`ADMIN_SESSION_SECRET`/`TURNSTILE_*` di `.env` hanya untuk `next dev`, tidak dipakai Worker.

## 5. Database & admin

```bash
npm run db:migrate:remote
```

Buat admin production (password ≥ 12 karakter acak). **PowerShell (Windows):**
```powershell
$p = Read-Host "Password admin baru" -AsSecureString
$env:ADMIN_USERNAME = "admin"
$env:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))
npm run seed:admin -- --remote
Remove-Item Env:ADMIN_PASSWORD, Env:ADMIN_USERNAME; Remove-Variable p
```
(`-AsSecureString`: password tidak tampil di layar dan tidak tersimpan di riwayat PowerShell.)
**bash / Git Bash:**
```bash
read -rs -p "Password admin baru: " ADMIN_PASSWORD && export ADMIN_PASSWORD ADMIN_USERNAME=admin
npm run seed:admin -- --remote; unset ADMIN_PASSWORD
```
Data produk & pesanan dari cPanel diimpor saat cutover (Skill 25/30:
`npm run db:export` → `npm run db:import -- --file … --remote`).
Foto lama: `npm run uploads:r2 -- --dir <folder di luar public/> --remote`.

## 6. Deploy

```bash
npm run deploy
```
Urutan otomatis: `scripts/check-deploy-env.mjs` (menolak bila `NEXT_PUBLIC_SITE_URL`
bukan https/masih localhost, `TURNSTILE_SITE_KEY` kosong/test key, `database_id`
placeholder, `public/uploads` berisi file, `ALLOW_TEST_CAPTCHA` atau nama berbau
rahasia/`DB_*` di `vars`, `TRUST_CF_CONNECTING_IP` ≠ "1", atau `NEXT_PUBLIC_*` bernama
rahasia; memberi peringatan bila nomor WA masih dummy) → `opennextjs-cloudflare build` →
penyaring rahasia bundle → `wrangler deploy`.

Cek sebelum deploy (opsional): `npm run cf:dryrun` (ukuran bundle; batas Free 3 MiB gzip, saat ini ±1,1 MiB).

## 7. Uji asap setelah deploy (wajib, di URL deploy)

- [ ] Beranda, katalog + filter, detail produk, toggle bahasa, keranjang
- [ ] Checkout (widget Turnstile muncul) → Order ID → tautan WhatsApp benar; coba juga keranjang besar (±50 baris)
- [ ] Cek pesanan dengan nomor HP (+ Order ID)
- [ ] Estimasi ongkir (bila `API_CO_ID_KEY` terpasang, §10a): pilih Provinsi → Kota → Kecamatan, "Lihat ongkir" menampilkan kurir + harga kelipatan Rp 1.000, pilih kurir → ringkasan menampilkan estimasi total, pesan WhatsApp berisi baris "Estimasi ongkir". Tanpa key: checkout memakai input teks kecamatan/kota dan WA berisi "Ongkir: dikonfirmasi via WhatsApp"
- [ ] Login admin, ubah status pesanan, pencarian pesanan, CRUD produk + **upload foto** (tidak ada error 411), kategori
- [ ] Ganti password admin di Pengaturan (± 10 ms CPU — bila muncul error "Exceeded CPU", lihat SKILLS 26a)
- [ ] `curl -I <url>/` menampilkan CSP, nosniff, X-Frame-Options, Referrer-Policy; console browser tanpa pelanggaran CSP
- [ ] `npx wrangler tail` bersih dari error selama uji

## 8. Proteksi kuota (sekali, dashboard)

- **WAF → Rate limiting rules** (1 aturan gratis): path `/api/admin/auth`, `/api/orders`,
  `/api/orders/lookup`, `/api/shipping/*`, mis. 20 request / 10 detik per IP → Block. Menahan banjir request
  sebelum menyentuh Worker/D1 (rate limit aplikasi tetap aktif di D1).
- **Notifications**: aktifkan peringatan penggunaan Workers & D1 mendekati batas Free
  (100 rb request/hari; D1 5 jt baca & 100 rb tulis/hari).

## 9. Deploy otomatis dari GitHub (opsional — Workers Builds)

Dashboard → Workers & Pages → `rasa-medan` → Settings → Builds → Connect repository:

| Pengaturan | Isi |
|---|---|
| Production branch | `main` |
| Build command | `npm run ci:build` (CI menjalankan `npm ci` sendiri) |
| Deploy command | `npx wrangler deploy` |
| Non-production branch builds | Aktif **hanya** bila staging (§9a) sudah disiapkan; selain itu matikan |
| Non-production branch deploy command | `npx wrangler deploy --env staging` — **jangan** `npx wrangler preview` / `versions upload` (keduanya memakai D1/R2 & secret production) |

- `npm run ci:build` (`scripts/ci-build.mjs`) membaca `WORKERS_CI_BRANCH`: untuk `main`
  membangun production; untuk branch lain (mis. `dev`) mengganti
  `NEXT_PUBLIC_SITE_URL` dengan Build variable `STAGING_SITE_URL`, lalu guard +
  `cf:build`.
- **Build variables** (berlaku untuk semua branch): HANYA `NEXT_PUBLIC_*`,
  `GOOGLE_SITE_VERIFICATION`, dan `STAGING_SITE_URL` — CI tidak punya file `.env`.
  **Jangan** taruh rahasia di sini (terlihat di pengaturan & log build).
- Rahasia runtime tetap lewat `wrangler secret put` (tidak perlu diulang tiap build).
- Guard di build command membaca `TURNSTILE_SITE_KEY` dan `database_id` dari
  `wrangler.jsonc` di repo — keduanya harus sudah di-commit sebelum push pertama, atau
  build CI gagal (sengaja).
- Cek di dashboard saat menyiapkan: nama Worker harus `rasa-medan` (sama dengan
  `name` di `wrangler.jsonc`).

Sampai Workers Builds diaktifkan, `npm run deploy` dari komputer pemilik adalah prosedur resmi.

### 9a. Staging untuk branch `dev` (preview)

Worker terpisah **`rasa-medan-staging`** (`env.staging` di `wrangler.jsonc`) dengan D1
`rasamedan-staging` dan R2 `rasa-medan-uploads-staging` sendiri — kode branch `dev`
tidak pernah menyentuh data pelanggan production. Sekali saja:

```bash
npx wrangler d1 create rasamedan-staging        # salin database_id → wrangler.jsonc env.staging, commit
npx wrangler r2 bucket create rasa-medan-uploads-staging   # tetap privat (r2.dev Disabled)
npm run db:migrate:staging
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" | npx wrangler secret put ADMIN_SESSION_SECRET --env staging
npx wrangler secret put TURNSTILE_SECRET_KEY --env staging
npm run seed -- --staging                        # opsional: produk dummy di staging
```
Admin staging (password berbeda dari production; PowerShell):
```powershell
$p = Read-Host "Password admin STAGING" -AsSecureString
$env:ADMIN_USERNAME = "admin"
$env:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))
npm run seed:admin -- --staging
Remove-Item Env:ADMIN_PASSWORD, Env:ADMIN_USERNAME; Remove-Variable p
```
Lalu:
- Build variable `STAGING_SITE_URL` = `https://rasa-medan-staging.<subdomain>.workers.dev`.
- Widget Turnstile: tambahkan hostname `rasa-medan-staging.<subdomain>.workers.dev`.
- Workers Builds: aktifkan non-production branch builds dengan deploy command
  `npx wrangler deploy --env staging` (tabel di atas). Push ke `dev` → staging
  ter-deploy; merge ke `main` → production.
- Tab **Previews Base** tidak punya filter branch; `ci:build` menggagalkan build
  branch selain `main`/`dev`, jadi hanya `dev` yang ter-deploy ke staging.
  **Wajib** cek deploy command non-production = `npx wrangler deploy --env staging`;
  default Cloudflare (`npx wrangler versions upload`) mengunggah kode branch sebagai
  versi Worker **production** (D1/R2/secret production).
- Manual tanpa CI (PowerShell), **tanpa** `.env` production di folder (Next
  meng-inline `NEXT_PUBLIC_*` lain dari `.env`, mis. nomor WA asli):
  `$env:STAGING_SITE_URL="https://…"; $env:WORKERS_CI_BRANCH="dev"; npm run ci:build`
  lalu `npx wrangler deploy --env staging`.
- Skrip D1 menerima `--staging` (otomatis remote): `seed`, `seed:admin`, `db:import`.

## 10. Operasional

- **Log langsung:** `npx wrangler tail` — menampilkan IP/URL/header pengunjung (data
  pribadi): jangan disimpan ke file atau dibagikan saat minta bantuan.
- **Log disk wrangler:** wrangler menyimpan output perintahnya (termasuk hasil
  `d1 execute` berisi data pelanggan dan `tail`) ke folder log selama 30 hari
  (Windows: `%APPDATA%\xdg.config\.wrangler\logs`). Sebelum perintah yang
  menampilkan data pribadi: PowerShell `$env:WRANGLER_WRITE_LOGS = "false"` /
  bash `export WRANGLER_WRITE_LOGS=false`; hapus isi folder log bila sudah terlanjur.
- **Rollback kode:** `npx wrangler deployments list` lalu `npx wrangler rollback <version-id>`.
  Tidak mengembalikan data D1, dan kode lama bisa tidak cocok dengan skema D1 yang sudah
  dimigrasi maju. Jangan rollback melewati rotasi secret atau perbaikan keamanan; bila
  terpaksa, jalankan ulang `wrangler secret put` untuk secret yang sudah dirotasi.
- **Backup D1:** Time Travel D1 menyimpan titik pulih 7 hari terakhir di paket Free (30 hari di Paid)
  (`npx wrangler d1 time-travel info rasamedan`, `… restore rasamedan --timestamp=…`).
  Backup manual berkala ke folder yang di-gitignore:
  `mkdir -p db-export` lalu
  `npx wrangler d1 export rasamedan --remote --output db-export/backup-YYYYMMDD.sql`
  (berisi data pribadi & hash password admin — pindahkan ke penyimpanan terenkripsi di
  luar repo, lalu hapus dari `db-export/`; semua `*.sql` data juga di-gitignore).
- **Menarik foto bermasalah** (salah unggah, hak cipta, ada data pribadi): foto disimpan di cache
  edge & browser (`immutable`, 1 tahun) — menghapus objek R2 saja tidak cukup. (1) Ganti foto produk
  di admin (upload baru = nama file baru); (2) hapus objek lama: `npx wrangler r2 object delete
  rasa-medan-uploads/uploads/<nama> --remote`; (3) dashboard → Caching → Purge Cache → Custom
  Purge → URL `https://<domain>/uploads/<nama>`.
- **Akun Cloudflare:** aktifkan 2FA, anggota akun seminimal mungkin, token API berhak
  terbatas; `npx wrangler logout` di komputer bersama.
- **Migrasi skema baru:** tambah `migrations/NNNN_*.sql` → uji `npm run db:migrate` lokal →
  `npm run db:migrate:remote` **sebelum** deploy kode yang membutuhkannya.
- **Checklist pre-deploy lengkap:** SKILLS.md 21.3 (isi setiap deploy).

### 10a. Estimasi ongkir api.co.id (Skill 31)

- **Aktif bila** secret `API_CO_ID_KEY` terpasang **dan** `vars.SHIPPING_ORIGIN_DISTRICT_CODE`
  berisi kode kecamatan 6 digit (sekarang `120733` = Kec. Beringin, Deli Serdang). Tanpa key,
  checkout otomatis kembali ke input teks kecamatan/kota — tidak ada yang rusak.
- **Urutan rilis (staging dulu):**
  1. `npm run db:migrate:staging` (migrasi `0004_shipping_estimate.sql`).
  2. `npx wrangler secret put API_CO_ID_KEY --env staging` → push `dev` → uji §7 di staging.
  3. `npm run db:migrate:remote` → `npx wrangler secret put API_CO_ID_KEY` → merge ke `main`.
- **Biaya:** Rp 5 per cek tarif yang **tidak** ada di cache (cache 12 jam per rute + berat).
  Batas: 5 cek/jam per IP, `SHIPPING_RATES_DAILY_CAP` (default 100) cek/hari total.
  Saldo api.co.id = anggaran keras: isi secukupnya, cek saldo berkala di dashboard api.co.id.
- **Saldo habis / key ditolak / kuota plan habis:** aplikasi berhenti memanggil api.co.id
  selama 60 menit (circuit breaker) dan checkout jatuh ke "ongkir dikonfirmasi via
  WhatsApp". Isi saldo / perbaiki key — pulih otomatis setelah jendela 60 menit.
- **Kill switch tanpa deploy:** `npx wrangler secret delete API_CO_ID_KEY` (tambahkan
  `--env staging` untuk staging). Pasang lagi dengan `secret put`.
- **Rotasi key:** buat key baru di dashboard api.co.id → `secret put` (production & staging)
  → nonaktifkan key lama.
- **Ganti asal kirim:** ubah `SHIPPING_ORIGIN_DISTRICT_CODE` di kedua blok `vars`
  `wrangler.jsonc` (kode dari `GET /courier/v1/locations/districts?city=<kode kota>`) lalu deploy.

---

## 11. Transisi dari cPanel ke Cloudflare (cutover — Skill 30)

Tujuan: `rasamedan.com` pindah dari aplikasi cPanel ke Worker dengan **data utuh**,
**downtime singkat** (±30–60 menit, di jam sepi), dan **jalan pulang** (rollback)
yang sudah dilatih. Ikuti fase berurutan; centang setiap butir.

### 11.0 Peta waktu

| Kapan | Fase | Situs pelanggan dilayani |
|---|---|---|
| H-7 s.d. H-3 | A. Persiapan: zona Cloudflare, resource, staging, gladi | cPanel |
| H-3 s.d. H-1 | B. Staging stabil ≥ 48 jam + latihan rollback | cPanel |
| Hari H (malam) | C. Cutover: bekukan cPanel → data final → domain ke Worker | Worker |
| H+0 s.d. H+2 | D. Observasi 48 jam (rollback masih mungkin) | Worker |
| H+2 | E. Kunci Cloudflare & matikan cPanel | Worker |
| H+30 | F. Arsipkan & hapus MySQL/cPanel | Worker |

### 11.1 Fase A — Persiapan (H-7)

**A1. Amankan cPanel yang masih live** (bila belum): rotasi `ADMIN_SESSION_SECRET`
+ ganti password admin cPanel (lihat peringatan paling atas di §3).

**A2. Pindahkan DNS domain ke Cloudflare — situs TETAP di cPanel.**
1. Dashboard Cloudflare → *Add a domain* → `rasamedan.com` → paket Free. Cloudflare
   memindai record DNS yang ada.
2. **Periksa daftar record sebelum lanjut**, terutama:
   - `A`/`AAAA` `rasamedan.com` & `www` → IP server cPanel (biarkan, *Proxied*);
   - **`MX`, `TXT` (SPF/DKIM/DMARC), `mail`, `autodiscover`** bila email domain
     dipakai di cPanel — salin persis, set *DNS only*; tanpa ini email berhenti;
   - record lain (subdomain, verifikasi Google, dll.).
3. **DNSSEC:** bila registrar mengaktifkan DNSSEC (ada DS record), **nonaktifkan
   dulu** di registrar dan tunggu ±24 jam sebelum ganti nameserver — kalau tidak,
   seluruh domain (situs + email) gagal resolve. Aktifkan lagi nanti dengan DS dari
   Cloudflare (*DNS → Settings → DNSSEC*) setelah zona Active.
4. Di registrar domain, ganti nameserver ke dua nameserver Cloudflare yang
   diberikan. Tunggu status zona **Active** (beberapa menit s.d. 24 jam).
5. SSL/TLS → mode **Full (strict)** bila sertifikat cPanel (Let's Encrypt/AutoSSL)
   valid, selain itu **Full**. Jangan *Flexible* (redirect loop & cookie admin
   `secure`). Mode ini hanya mengatur koneksi Cloudflare → cPanel selama situs masih
   di cPanel (Fase A–B dan saat rollback); Worker tidak terpengaruh. Pastikan
   sertifikat origin cPanel tetap valid selama itu (AutoSSL di balik proxy bisa gagal
   memperbarui — cek tanggal kedaluwarsanya). Cek `https://rasamedan.com` masih
   normal dan email masih masuk/keluar.
6. SSL/TLS → Edge Certificates → **Always Use HTTPS** aktifkan sekarang (aman untuk
   cPanel di balik Cloudflare) — sejak cutover, `http://…/admin/login` tidak pernah
   mengirim password tanpa enkripsi. Bila ada record `CAA` lama, pastikan mengizinkan
   CA yang dipakai Cloudflare (atau hapus CAA) agar sertifikat Worker bisa terbit.
7. **Amankan akun pemegang domain:** 2FA di akun registrar **dan** Cloudflare,
   aktifkan *registrar/transfer lock*, dan pastikan email pemulihan kedua akun itu
   **bukan** alamat `@rasamedan.com` yang di-host di cPanel (akan dimatikan).

**A3. Resource & staging:** kerjakan §1–§8 (D1, R2 privat, Turnstile, rahasia,
`.env` dengan `NEXT_PUBLIC_SITE_URL=https://rasa-medan.<subdomain>.workers.dev`,
`db:migrate:remote`, `seed:admin --remote`, `npm run deploy`, uji asap §7).
Widget Turnstile: daftarkan hostname `rasa-medan.<subdomain>.workers.dev`
**dan** `rasamedan.com` + `www.rasamedan.com` sekaligus (tidak perlu diubah saat H).

**A4. Akses data cPanel untuk ekspor:**
- Buat user MySQL **read-only** (cPanel → MySQL Databases: user baru, password acak
  ≥ 24 karakter, hak **`SELECT` saja** pada database toko — ekspor memakai snapshot
  transaksi, tidak perlu `LOCK TABLES`).
- Utamakan SSH tunnel yang hanya mendengar di komputer Anda:
  `ssh -L 127.0.0.1:3307:localhost:3306 <user>@<host-cpanel>`. Bila SSH tidak
  tersedia: cPanel → *Remote MySQL* → tambahkan IP Anda **hanya selama ekspor
  berlangsung** (A5, C3) dan hapus lagi segera sesudahnya (IP rumah/seluler sering
  dipakai bersama pelanggan ISP lain), lalu ekspor dengan `--allow-remote-host`
  (wajib TLS) — lihat komentar `scripts/export-mysql.mjs`.
- Isi `DB_*` di `.env` (`DB_HOST=127.0.0.1`, `DB_PORT=3307`, user read-only).

**A5. Gladi bersih data (tanpa menyentuh production):**
```bash
npm i --no-save mysql2
npm run db:export
npm run db:import -- --file db-export/<file-hasil-ekspor>.sql
npm run dev -- -H 127.0.0.1
```
(`-H 127.0.0.1`: server dev berisi data pelanggan asli tidak bisa dibuka dari
perangkat lain di jaringan — mode dev melonggarkan captcha & rate limit.)
`db:import` tanpa `--remote` = D1 **lokal**. Semua cek impor harus ✓; di
`npm run dev` cek katalog dan cek pesanan lama dengan nomor HP pelanggan asli.
Bila ekspor berhenti (mis. kategori yatim, status tak dikenal), perbaiki datanya di
admin cPanel lalu ulangi. Setelah gladi: hapus file di `db-export/`; kembalikan D1
lokal ke data dummy dengan menghapus folder `.wrangler/state/v3/d1` lalu
`npm run db:migrate` + `npm run seed`.

**A6. Foto lama ke R2 (boleh lebih awal — nama file unik dan tidak berubah):**
cPanel File Manager → `public/uploads` → *Compress* → unduh → ekstrak ke folder
**di luar proyek** (mis. `../foto-cpanel`), lalu:
```bash
npm run uploads:r2 -- --dir ../foto-cpanel --dry-run
npm run uploads:r2 -- --dir ../foto-cpanel --remote
```
Periksa daftar file yang dilewati (bukan gambar / nama tidak aman) — foto produk
itu perlu diunggah ulang lewat admin setelah cutover.

### 11.2 Fase B — Staging stabil & latihan rollback (H-3 s.d. H-1)

- **Matikan log disk wrangler selama H-7 s.d. H+2** (berlaku untuk semua terminal
  baru, termasuk `tail` di Fase B & D): PowerShell `setx WRANGLER_WRITE_LOGS false`
  (buka terminal baru setelahnya); hapus lagi setelah Fase E dengan
  `[Environment]::SetEnvironmentVariable("WRANGLER_WRITE_LOGS", $null, "User")`.
- Biarkan staging berjalan ≥ 48 jam; pantau *Workers & Pages → rasa-medan →
  Metrics/Logs* dan `npx wrangler tail` (error, "Exceeded CPU"). Ulangi uji asap §7,
  termasuk ganti password admin dan checkout besar.
- **Latihan cutover & rollback dengan subdomain** (syarat Skill 30 "rollback
  teruji") — meniru persis langkah C7 dan rollback D1–D2:
  1. DNS → buat record `A` `beta` → IP cPanel (*Proxied*); buka
     `https://beta.rasamedan.com` (boleh tampil halaman default cPanel).
  2. Catat IP, **hapus** record `beta`, lalu *Workers & Pages → rasa-medan →
     Settings → Domains & Routes → Add → Custom domain* → `beta.rasamedan.com` →
     ukur berapa lama sampai situs Worker tampil (perkiraan jeda C7).
  3. Rollback: hapus custom domain `beta`, buat lagi record `A` `beta` → IP cPanel →
     pastikan kembali ke cPanel. Hapus record `beta` setelah selesai (jangan
     biarkan record yatim).
  4. Di jam sepi, latih juga *Setup Node.js App → Stop App* lalu **Start App** di
     cPanel (±1 menit) agar langkah C2/rollback 3 sudah pernah dicoba.
- **Bersihkan data uji staging dari D1 production** (wajib — `db:import` menolak D1
  yang berisi data). Pesanan, produk, dan kategori yang dibuat saat uji asap ikut
  tersimpan di D1 yang sama:
  ```bash
  npx wrangler d1 execute rasamedan --remote --command "DELETE FROM order_items; DELETE FROM orders; DELETE FROM product_variants; DELETE FROM products; DELETE FROM login_failures;"
  npx wrangler d1 execute rasamedan --remote --command "SELECT id, name, slug FROM categories"
  ```
  Hapus kategori uji yang tidak ada di cPanel (kategori asli akan di-upsert saat
  impor): `… --command "DELETE FROM categories WHERE slug = '<slug-uji>'"`. Akun
  admin tetap (dipakai lagi setelah cutover). Foto uji di R2 boleh dibiarkan (tidak
  dirujuk produk mana pun), **kecuali** yang sensitif (mis. foto KTP/struk saat uji)
  — foto tetap bisa dibuka lewat `/uploads/<nama>`; hapus dengan
  `npx wrangler r2 object delete rasa-medan-uploads/uploads/<nama> --remote`. Mulai saat ini **jangan uji checkout/CRUD lagi** di
  staging sampai cutover.
- Tentukan jam cutover (sepi pesanan, mis. 22.00 WIB); beri tahu pelanggan bila
  perlu ("perawatan ±1 jam").

### 11.3 Fase C — Cutover (Hari H)

Catat **jam mulai** dalam UTC (dipakai saat rollback). Kerjakan berurutan:

0. **Gerbang keamanan:** checklist pre-deploy SKILLS.md 21.3 terisi penuh, kecuali
   butir bertanda "diisi di Fase F4" (audit
   tanpa temuan Kritis/Tinggi, secret dirotasi, `npx wrangler secret list` tanpa
   `ALLOW_TEST_CAPTCHA`, 2FA Cloudflare & registrar + transfer lock dari A2,
   `npm run cf:dryrun` lolos, `git status` bersih dari file data). Matikan log disk
   wrangler untuk sesi ini — wrangler menyimpan output perintah (termasuk hasil query
   berisi data pelanggan) ke folder log selama 30 hari:
   PowerShell `$env:WRANGLER_WRITE_LOGS = "false"` / bash `export WRANGLER_WRITE_LOGS=false`.
   **Cek sebelum mulai:** data uji staging sudah dibersihkan (Fase B) —
   `npx wrangler d1 execute rasamedan --remote --command "SELECT (SELECT COUNT(*) FROM products) AS p, (SELECT COUNT(*) FROM orders) AS o"`
   harus `0 / 0`; `.env` berisi `NEXT_PUBLIC_WA_NUMBER` nomor asli (guard deploy
   hanya memberi peringatan, tidak memblokir); bila Workers Builds (§9) aktif, ubah
   dulu Build variable `NEXT_PUBLIC_SITE_URL` di dashboard ke `https://rasamedan.com`
   — kalau tidak, push berikutnya men-deploy ulang build berisi URL workers.dev.
1. **Titik pulih D1 (keadaan bersih):** `npx wrangler d1 time-travel info rasamedan`
   — catat bookmark.
2. **Bekukan cPanel:** cPanel → *Setup Node.js App* → **Stop App**. Situs lama
   berhenti menerima pesanan; database MySQL tetap utuh. Sejak titik ini jangan ada
   perubahan data di cPanel.
3. **Skema terbaru & ekspor final:** `npm run db:migrate:remote` (pastikan semua
   `migrations/*.sql`, termasuk yang ditambahkan sejak staging, sudah diterapkan —
   kode yang di-deploy di C6 membutuhkannya), lalu dengan tunnel aktif:
   `npm run db:export`.
4. **Impor ke production:** `npm run db:import -- --file db-export/<file>.sql --remote`
   → semua ✓. Bila ditolak "D1 tujuan sudah berisi data" (data uji tertinggal) atau
   gagal di tengah: kosongkan tabel data (perintah di Fase B / kepala
   `scripts/import-d1.mjs`) lalu ulangi langkah 4.
5. **Foto selisih:** unduh lagi `public/uploads` cPanel (foto baru sejak A6) →
   `npm run uploads:r2 -- --dir ../foto-cpanel --remote`.
6. **Build untuk domain asli:** di `.env` ganti
   `NEXT_PUBLIC_SITE_URL=https://rasamedan.com`, lalu `npm run deploy`
   (canonical, sitemap, dan cek hostname Turnstile mengikuti nilai ini). Sejak deploy
   ini sampai C7 selesai, URL workers.dev menolak login/checkout (hostname captcha
   tidak cocok) — wajar, jangan dipakai untuk "cek cepat".
7. **Pindahkan domain ke Worker** (situs tidak dapat diakses di antara 7.2 dan 7.4 —
   lakukan cepat; perkiraan jeda sudah diukur saat latihan Fase B):
   1. Tambahkan ke `wrangler.jsonc` (sumber kebenaran konfigurasi — deploy
      berikutnya tetap konsisten), **belum** di-deploy. `preview_urls: false` sekarang
      juga (URL preview melewati WAF zona); `workers_dev` dimatikan di Fase E karena
      masih berguna selama observasi.
      ```jsonc
      "routes": [
        { "pattern": "rasamedan.com", "custom_domain": true },
        { "pattern": "www.rasamedan.com", "custom_domain": true }
      ],
      "preview_urls": false,
      ```
   2. DNS → **catat** SEMUA record `A`/`AAAA`/`CNAME` bernama `rasamedan.com` dan
      `www` beserta nilainya (untuk rollback), lalu **hapus** semuanya (Cloudflare
      menolak custom domain yang bentrok dengan record mana pun di nama itu).
   3. Segera jalankan `npx wrangler deploy` — memakai build dari C6 (tanpa build
      ulang, selesai dalam hitungan detik) dan memasang kedua custom domain.
      (Alternatif: *Workers & Pages → rasa-medan → Settings → Domains & Routes →
      Add → Custom domain*, seperti latihan Fase B.)
   4. Cek *Domains & Routes* menampilkan keduanya **Active**; sertifikat SSL terbit
      otomatis (biasanya beberapa menit). Commit perubahan `wrangler.jsonc` — bila
      Workers Builds aktif, pastikan langkah 0 (Build variables) sudah dikerjakan.
8. **www → domain utama:** *Rules → Redirect Rules* → aturan baru: hostname sama
   dengan `www.rasamedan.com` → redirect dinamis ke
   `concat("https://rasamedan.com", http.request.uri.path)`, status 301, pertahankan
   query string — mencegah konten ganda di mesin pencari.
9. **Uji asap di `https://rasamedan.com`** (§7 lengkap): checkout sampai pesan
   WhatsApp terbentuk ke nomor asli, **cek pesanan lama** dengan nomor HP pelanggan
   nyata, login admin (akun yang dibuat `seed:admin` di A3 — `seed:admin` tidak
   menimpa password akun yang sudah ada; untuk password baru pakai `-- --reset`),
   ubah status, isi resi, upload foto, foto produk lama tampil, versi `www`
   dialihkan, dan **sumber halaman beranda** berisi
   `<link rel="canonical" href="https://rasamedan.com…"` serta `/sitemap.xml` memakai
   `https://rasamedan.com` (bukan workers.dev).
10. **Titik pulih kedua:** `npx wrangler d1 time-travel info rasamedan` — catat.

### 11.4 Fase D — Observasi 48 jam & rollback

Pantau Metrics/Logs Worker, pemakaian D1, dan pesanan masuk di admin (log disk
wrangler tetap mati — lihat Fase B). cPanel tetap **berhenti tetapi utuh**
(aplikasi + MySQL).

**Rollback** — hanya bila ada masalah besar yang tidak bisa diperbaiki cepat
(pastikan `WRANGLER_WRITE_LOGS=false` seperti di C0):
0. **Amankan data Worker dulu:** minta admin berhenti mengubah data di dashboard Worker,
   lalu `mkdir -p db-export` dan
   `npx wrangler d1 export rasamedan --remote --output db-export/rollback-<waktu>.sql`
   (salinan lengkap termasuk `order_items`, alamat, catatan, resi — simpan terenkripsi;
   dipakai bila pesanan perlu direkonstruksi).
1. *Workers & Pages → rasa-medan → Settings → Domains & Routes* → hapus custom
   domain `rasamedan.com` dan `www` (dan hapus blok `routes` dari `wrangler.jsonc`
   agar deploy berikutnya tidak memasangnya lagi).
2. DNS → pasang lagi record `A`/`AAAA`/`CNAME` `rasamedan.com` & `www` persis seperti
   yang dicatat di C7.2 (*Proxied*). Hapus Redirect Rule www bila mengganggu.
3. cPanel → *Setup Node.js App* → **Start App**; cek situs lama berjalan.
4. **Pesanan yang dibuat ATAU diubah di Worker sejak cutover** (pesanan baru, status
   baru, resi) belum ada di MySQL. Tampilkan (ganti jam dengan jam mulai C, UTC):
   ```bash
   npx wrangler d1 execute rasamedan --remote --command "SELECT order_code, recipient_name, phone, fulfillment_method, city, status, courier_code, waybill, total_estimate, created_at, updated_at FROM orders WHERE created_at >= '2026-10-20T15:00:00Z' OR updated_at >= '2026-10-20T15:00:00Z' ORDER BY created_at"
   ```
   Lalu: perbarui **status** pesanan lama itu di admin cPanel; untuk pesanan
   **baru** (admin cPanel tidak bisa membuat pesanan), konfirmasi ke pelanggannya via
   WhatsApp **dengan Order ID dari Worker** (yang dipegang pelanggan) dan catat di
   luar sistem — rincian item ada di ekspor langkah 0. Situs cPanel lama tidak punya
   fitur resi (Skill 22): kabari nomor resi yang sudah diisi lewat WhatsApp. Output
   berisi data pribadi — jangan disimpan ke file publik.
5. Perbaiki masalahnya di staging, lalu ulangi Fase C dengan ekspor final baru.
   Sebelum impor ulang, D1 production harus kosong lagi: pulihkan ke bookmark C1
   (keadaan bersih setelah Fase B) dengan
   `npx wrangler d1 time-travel restore rasamedan --bookmark=<bookmark C1>` —
   **membuang semua perubahan setelah C1**, jadi kerjakan langkah 4 lebih dulu —
   atau kosongkan tabel data dengan perintah di Fase B.

> **Rollback setelah Fase E:** (1) HSTS sudah aktif — situs cPanel harus tetap HTTPS
> dengan sertifikat valid (browser pelanggan menolak HTTP selama `max-age` HSTS);
> (2) env var rahasia sudah dihapus dan password MySQL aplikasi diganti — sebelum
> Start App, isi ulang di panel Node.js App: `DB_PASS` dengan password **baru** dan
> `ADMIN_SESSION_SECRET` dengan nilai acak **baru** (jangan pernah nilai lama yang bocor).

### 11.5 Fase E — Kunci Cloudflare & matikan cPanel (H+2, setelah stabil)

- [ ] `wrangler.jsonc`: tambahkan `"workers_dev": false` dan `"preview_urls": false`,
      lalu `npm run deploy` — URL workers.dev/preview melewati aturan WAF zona.
      Pastikan `https://rasa-medan.<subdomain>.workers.dev` tidak lagi merespons dan
      `npx wrangler tail` masih menampilkan log domain asli.
- [ ] Turnstile: hapus hostname `*.workers.dev` dari widget; pastikan
      `rasamedan.com` dan `www.rasamedan.com` tetap terdaftar. Redirect www (C8)
      sudah teruji.
- [ ] SSL/TLS → Edge Certificates: **HSTS** aktif — mulai `max-age` 1 hari, naikkan ke
      6 bulan setelah seminggu tanpa masalah; **includeSubDomains OFF** sampai semua
      subdomain (mail/webmail, dll.) HTTPS atau sudah dihapus; jangan *preload*.
      (Always Use HTTPS sudah aktif sejak A2.)
- [ ] WAF Rate Limiting & notifikasi penggunaan (§8) aktif.
- [ ] **Inventaris DNS** (*DNS → Records*): cari semua record yang masih menunjuk IP
      server cPanel (`mail`, `webmail`, `cpanel`, `whm`, `webdisk`, `ftp`,
      `cpcalendars`, `cpcontacts`, `autodiscover`, `autoconfig`, wildcard `*`, dll.)
      dan hapus yang tidak dipakai — record yatim ke server shared hosting bisa
      diambil alih penyewa lain server itu. Bila email masih di cPanel, biarkan
      record email sampai email dipindah (lihat Fase F).
- [ ] Setelah tidak ada lagi record *Proxied* ke cPanel: SSL/TLS → mode **Full
      (strict)**.
- [ ] cPanel dikunci (MySQL masih berisi seluruh data pelanggan sampai H+30):
      Node.js App tetap **Stop**; hapus env var rahasia di panel Node.js App
      (`ADMIN_SESSION_SECRET`, `DB_PASS` — isi ulang hanya bila rollback); hapus user
      MySQL read-only dan entri *Remote MySQL*; ganti password user MySQL aplikasi;
      ganti password akun cPanel + aktifkan 2FA; cabut kunci SSH & token API cPanel
      yang dibuat untuk migrasi; matikan cron/backup lama yang tidak perlu.
- [ ] Opsional: pastikan file proyek cPanel tidak tersaji publik setelah Stop App —
      `curl -sk --resolve rasamedan.com:443:<IP-cPanel> https://rasamedan.com/package.json`
      harus 403/404 (cek juga `/.env`).
- [ ] Hapus `db-export/*.sql`, zip `public/uploads` di folder Unduhan, dan folder
      `../foto-cpanel` dari komputer (Shift+Delete / `Remove-Item`); kosongkan `DB_*`
      di `.env`; hapus log wrangler yang mungkin berisi data pelanggan:
      PowerShell `Remove-Item "$env:APPDATA\xdg.config\.wrangler\logs\*"` (lokasi
      default di Windows; macOS/Linux umumnya di bawah `~/.config/.wrangler/logs` atau
      `~/Library/Preferences/.wrangler/logs` — atau tetapkan sendiri lokasinya dengan
      env `WRANGLER_LOG_PATH`). Lalu hapus pengaturan `WRANGLER_WRITE_LOGS` dari Fase B.
- [ ] D1 production tanpa tabel `_seed_guard`:
      `npx wrangler d1 execute rasamedan --remote --command "SELECT name FROM sqlite_master WHERE name = '_seed_guard'"` → kosong.
- [ ] Google Search Console: kirim ulang `https://rasamedan.com/sitemap.xml`.
- [ ] Email domain (bila dipakai) masih normal.
- [ ] Backup D1 pertama (§10) disimpan terenkripsi di luar repo; pasang pengingat
      kalender mingguan.
- [ ] Bila memakai cache foto (Skill 27): uji purge satu URL foto (§10) agar
      prosedur penarikan foto teruji.
- [ ] SKILLS.md: tandai Skill 30 ✅ di tabel status; tutup Skill 15 dan temuan
      21.2 no. 1–6 yang kini terpenuhi di production (secret sudah dirotasi, cPanel
      mati); perbarui PRD §5.1 bila perlu (sudah D1 sejak Skill 24).

### 11.6 Fase F — Arsip (H+30)

Cadangan rollback MySQL disimpan minimal 30 hari. Setelah itu:
0. **Email:** bila email `@rasamedan.com` masih di cPanel, pindahkan dulu (mis.
   Cloudflare Email Routing atau penyedia email lain) dan perbarui `MX`/SPF/DKIM;
   hapus `include`/IP cPanel dari SPF. Jangan hentikan hosting sebelum email pindah.
1. cPanel → phpMyAdmin → *Export* database toko (format SQL) → enkripsi (mis. 7-Zip,
   AES-256, password di password manager) → simpan di luar laptop & repo (arsip,
   bukan untuk dipakai lagi). **Verifikasi** arsip bisa dibuka (ukuran wajar, berisi
   `INSERT INTO orders …`) sebelum lanjut. Tetapkan tanggal hapus arsip (mis. H+180,
   prinsip retensi terbatas UU PDP) dan catat saat sudah dihapus.
2. Unduh arsip `public/uploads` cPanel terakhir sebagai cadangan foto; verifikasi
   bisa diekstrak.
3. Baru setelah kedua arsip terverifikasi: hapus database & aplikasi Node.js di
   cPanel; hentikan paket hosting bila tidak dipakai untuk hal lain.
4. **Segera setelah hosting berhenti:** hapus SEMUA record DNS yang masih menunjuk IP
   server cPanel (termasuk record email lama) — IP itu akan dipakai pelanggan lain.
