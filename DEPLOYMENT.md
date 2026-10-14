# DEPLOYMENT.md
## Panduan Deploy "Rasa Medan" ke Cloudflare Workers

Aplikasi berjalan di **Cloudflare Workers** (paket Free) lewat `@opennextjs/cloudflare`:
database **D1**, foto produk **R2**, captcha **Turnstile**. Panduan cPanel lama
diarsip di [`docs/legacy/DEPLOYMENT-cpanel.md`](docs/legacy/DEPLOYMENT-cpanel.md)
(hanya untuk hotfix darurat dari commit `fb4ea12`).

> Cutover domain `rasamedan.com` dari cPanel (impor data final, DNS, pensiun
> cPanel) adalah **Skill 30** — dokumen ini menyiapkan deploy yang bisa diuji di
> `*.workers.dev` lebih dulu.

---

## 0. Peta konfigurasi (di mana setiap nilai tinggal)

| Jenis | Contoh | Lokasi | Kapan dibaca |
|---|---|---|---|
| Publik, di-inline ke JS | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WA_NUMBER`, info toko | `.env` (deploy dari komputer) **atau** Build variables Workers Builds | **saat build** — ubah nilai = build & deploy ulang |
| Non-rahasia runtime | `TURNSTILE_SITE_KEY`, `TRUST_CF_CONNECTING_IP` | `vars` di `wrangler.jsonc` (di-commit) | saat request |
| Rahasia runtime | `ADMIN_SESSION_SECRET`, `TURNSTILE_SECRET_KEY` | `npx wrangler secret put <NAMA>` | saat request |
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
- [ ] Login admin, ubah status pesanan, pencarian pesanan, CRUD produk + **upload foto** (tidak ada error 411), kategori
- [ ] Ganti password admin di Pengaturan (± 10 ms CPU — bila muncul error "Exceeded CPU", lihat SKILLS 26a)
- [ ] `curl -I <url>/` menampilkan CSP, nosniff, X-Frame-Options, Referrer-Policy; console browser tanpa pelanggaran CSP
- [ ] `npx wrangler tail` bersih dari error selama uji

## 8. Proteksi kuota (sekali, dashboard)

- **WAF → Rate limiting rules** (1 aturan gratis): path `/api/admin/auth`, `/api/orders`,
  `/api/orders/lookup`, mis. 20 request / 10 detik per IP → Block. Menahan banjir request
  sebelum menyentuh Worker/D1 (rate limit aplikasi tetap aktif di D1).
- **Notifications**: aktifkan peringatan penggunaan Workers & D1 mendekati batas Free
  (100 rb request/hari; D1 5 jt baca & 100 rb tulis/hari).

## 9. Deploy otomatis dari GitHub (opsional — Workers Builds)

Dashboard → Workers & Pages → `rasa-medan` → Settings → Builds → Connect repository:
- Branch production: `main`
- Build command: `npm ci && node scripts/check-deploy-env.mjs && npm run cf:build`
- Deploy command: `npx wrangler deploy`
- **Build variables**: HANYA `NEXT_PUBLIC_*` (+ `GOOGLE_SITE_VERIFICATION`) dengan nilai
  production — CI tidak punya file `.env`. **Jangan** taruh rahasia di sini (terlihat di
  pengaturan & log build).
- **Matikan build cabang non-produksi** (Settings → Builds → *non-production branch
  builds*): versi preview memakai D1/R2 dan secret production yang sama, jadi kode
  cabang mana pun bisa membaca/menulis data pelanggan asli lewat URL preview.
- Rahasia runtime tetap lewat `wrangler secret put` (tidak perlu diulang tiap build).
- Guard di build command membaca `TURNSTILE_SITE_KEY` dan `database_id` dari
  `wrangler.jsonc` di repo — keduanya harus sudah di-commit sebelum push pertama, atau
  build CI gagal (sengaja).
- Cek di dashboard saat menyiapkan: nama Worker harus `rasa-medan` (sama dengan
  `name` di `wrangler.jsonc`); bila kolom build command tidak menerima `&&`, buat skrip
  npm `ci:build` berisi rangkaian yang sama.

Sampai Workers Builds diaktifkan, `npm run deploy` dari komputer pemilik adalah prosedur resmi.

## 10. Operasional

- **Log langsung:** `npx wrangler tail` — menampilkan IP/URL/header pengunjung (data
  pribadi): jangan disimpan ke file atau dibagikan saat minta bantuan.
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
- **Akun Cloudflare:** aktifkan 2FA, anggota akun seminimal mungkin, token API berhak
  terbatas; `npx wrangler logout` di komputer bersama.
- **Migrasi skema baru:** tambah `migrations/NNNN_*.sql` → uji `npm run db:migrate` lokal →
  `npm run db:migrate:remote` **sebelum** deploy kode yang membutuhkannya.
- **Checklist pre-deploy lengkap:** SKILLS.md 21.3 (isi setiap deploy).
