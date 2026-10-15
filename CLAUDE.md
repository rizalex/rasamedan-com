# AGENTS.md
## Panduan Agent untuk Pengembangan "Rasa Medan - Oleh-Oleh Khas Medan" (MVP)

Dokumen ini adalah instruksi kerja untuk Claude Code (atau AI coding agent lain) saat membangun, mengedit, atau memperluas aplikasi ini. Baca dokumen ini SEBELUM membuat/mengubah kode apa pun.

---

## 1. Ringkasan Proyek

Website katalog produk untuk UMKM penjual makanan ringan khas Medan (kue, makanan kering, sirup). Pelanggan browsing & checkout **tanpa akun/login**. Transaksi diselesaikan manual via WhatsApp (konfirmasi stok, ongkir, pembayaran QR/transfer). Ada dashboard admin sederhana untuk kelola produk & status pesanan.

Referensi lengkap kebutuhan produk ada di `PRD-Rasa-Medan_Toko-Oleh-Oleh-Medan.md` — **agent wajib merujuk ke file itu sebagai sumber kebenaran (source of truth) untuk requirement**, dokumen ini hanya panduan teknis eksekusinya.

---

## 2. Tech Stack (WAJIB, jangan ganti tanpa konfirmasi user)

| Layer | Teknologi |
|---|---|
| Frontend/Framework | Next.js (App Router) |
| Styling | CSS murni / CSS Modules (hindari framework berat kecuali diminta) |
| Bahasa | HTML5, JavaScript (TypeScript boleh jika tidak menambah kompleksitas berlebih) |
| Database | Cloudflare **D1** (SQLite via binding `DB`, sejak Skill 24). Skema di `migrations/NNNN_*.sql`; skema MySQL lama diarsip di `docs/legacy/schema-mysql.sql` |
| ORM/Query | Query SQL parameterized lewat helper `lib/db.ts`; tanpa ORM yang butuh binary/engine native |
| Auth Admin | Session/JWT sederhana, HANYA untuk admin (pelanggan tidak butuh akun) |
| i18n | next-intl atau solusi ringan setara, default `id`, opsi `en` |
| Deployment target | **Cloudflare Workers** via `@opennextjs/cloudflare` + flag `nodejs_compat` (paket Free). Production lama tetap berjalan di cPanel sampai cutover Skill 30, tetapi **tidak bisa di-deploy ulang dari `main`** sejak Skill 23 (`server.js` dihapus, tanpa cabang legacy — keputusan pemilik). Hotfix cPanel darurat: dari commit `fb4ea12` |
| Upload foto | Cloudflare **R2** (binding `UPLOADS`, sejak Skill 27), disajikan route `app/uploads/[...path]` di URL `/uploads/<nama>`. Lokal memakai R2 tiruan (miniflare), bukan disk |

### Batasan Deployment Cloudflare Workers (PENTING)
- **Tanpa filesystem persisten:** jangan memakai `node:fs` untuk data runtime; data statis di-`import`, file upload ke R2.
- **Tanpa koneksi TCP langsung ke database:** data lewat binding D1 (`getCloudflareContext().env.DB`).
- **Batas CPU 10 ms/request (Free):** hindari komputasi berat seperti scrypt; hashing password memakai PBKDF2 Web Crypto (Skill 26).
- **State in-memory per isolate tidak andal** (bisa hilang/berbeda antar request); state yang harus bertahan (mis. rate limit) disimpan di D1.
- **Konfigurasi runtime** lewat `wrangler.jsonc` (vars & binding) dan `wrangler secret put` untuk rahasia — bukan file `.env` di server. Variabel `NEXT_PUBLIC_*` di-inline **saat build**. Secret lokal untuk `wrangler dev` ada di `.dev.vars` (tidak di-commit).
- Jangan memakai `export const runtime = "edge"`, middleware kompleks, atau ISR.
- Tanpa dependensi yang butuh binary native di runtime.
- Jangan membuat nilai acak, timer, atau I/O di global scope modul — lakukan di dalam handler/fungsi.
- Batas ukuran bundle Worker Free: 3 MiB terkompresi (cek dengan `npm run cf:dryrun`).
- `server.js`/Passenger sudah dihapus (Skill 23); jangan dibuat ulang.

---

## 3. Struktur Folder yang Disarankan

```
/app
  /(public)
    /page.tsx                → Beranda
    /produk/page.tsx         → Katalog + filter/search
    /produk/[slug]/page.tsx  → Detail produk
    /keranjang/page.tsx      → Cart
    /checkout/page.tsx       → Form checkout + generate WA link
    /cek-pesanan/page.tsx    → Cek status via no HP
    /tentang/page.tsx
    /kontak/page.tsx
  /admin
    /login/page.tsx
    /dashboard/page.tsx
    /dashboard/produk/page.tsx
    /dashboard/pesanan/page.tsx
  /api
    /products/route.ts
    /orders/route.ts
    /admin/auth/route.ts
/components
  /ui                        → button, badge, card, dsb (reusable)
  /product                   → ProductCard, ProductGallery, StockBadge
  /cart                      → CartItem, CartSummary
  /checkout                  → CheckoutForm
  /admin                     → AdminTable, OrderStatusSelect
/lib
  /db.ts                     → helper query D1 (query/execute/batch)
  /whatsapp.ts               → helper generate wa.me link
  /i18n.ts
/data
  /dummy-products.json       → data dummy untuk development
/public
  /uploads                   → kosong (foto produk di R2, URL /uploads/* dilayani route)
  /images (aset statis: logo, ornamen Melayu, dll)
```

---

## 4. Konvensi Kode

- Penamaan variabel/fungsi: **Bahasa Inggris** (standar industri), teks yang tampil ke user: **sesuai bahasa aktif (id/en)**.
- Semua teks UI **publik** HARUS melalui sistem i18n — jangan hardcode string ke JSX langsung.
- **Pengecualian (keputusan pemilik, 13 Okt 2026 — Skill 20.4):** dashboard admin (`app/admin/**`, `components/admin/**`) cukup Bahasa Indonesia; teksnya boleh ditulis langsung di komponen admin. Komponen yang juga dipakai halaman publik tetap wajib i18n.
- Komponen kecil & reusable, ikuti struktur folder di atas.
- Mobile-first: setiap komponen baru harus dites tampilannya di lebar layar ~375px dulu.
- Gunakan CSS variables untuk warna tema (lihat bagian 5) agar mudah konsisten.

---

## 5. Identitas Visual (Wajib Dipatuhi)

```css
/* Palet redesign (Skill 17): merah marun DIHAPUS; hijau tua + emas + krem. */
:root {
  --color-primary: #14432E;     /* Hijau Tua - utama/CTA & brand */
  --color-secondary: #1E5631;   /* Hijau (aksen sekunder) */
  --color-accent: #D4AF37;      /* Emas/Kuning Keemasan */
  --color-bg: #FFF8F0;          /* Krem/Putih Gading */
  --color-text: #2B2B2B;
}
```
Ornamen Melayu (motif pucuk rebung/awan larat) boleh digunakan sebagai elemen dekoratif SVG ringan di header/footer — tidak menutupi konten utama.

---

## 6. Aturan Bisnis Kritis (JANGAN DILANGGAR)

1. Pelanggan **tidak boleh** diwajibkan membuat akun untuk browsing atau checkout.
2. Tidak ada payment gateway otomatis — pembayaran selalu manual via WhatsApp + QR statis/transfer.
3. Ongkir **tidak dihitung otomatis** oleh sistem — itu tanggung jawab pemilik via WhatsApp (kecuali metode pickup, tidak ada ongkir).
4. Setiap pesanan yang dibuat WAJIB mendapat **Order ID unik** (format: `ORD-YYYYMMDD-XXXX`) sebelum diarahkan ke WhatsApp.
5. Status pesanan mengikuti daftar baku di PRD bagian 2.1 — jangan menambah/mengubah status tanpa update PRD juga.
6. Nomor WhatsApp yang dipakai selama development adalah **dummy**: `+62 812-0000-0000` — pastikan disimpan di `.env` (`NEXT_PUBLIC_WA_NUMBER`) supaya mudah diganti user saat deployment, JANGAN hardcode di banyak file.

---

## 7. Definition of Done (per fitur)

Sebuah fitur dianggap selesai jika:
- [ ] Berfungsi di mobile & desktop
- [ ] Teks sudah melalui i18n (id/en)
- [ ] Tidak ada data sensitif/hardcoded credential
- [ ] Sesuai dengan aturan bisnis di bagian 6
- [ ] Sudah dicek terhadap checklist di `SKILLS.md` untuk modul terkait
