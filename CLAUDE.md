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
| Database | MySQL |
| ORM/Query | Gunakan query builder ringan atau `mysql2`/Prisma — pilih yang paling mudah di-deploy di cPanel (hindari yang butuh binary compile berat) |
| Auth Admin | Session/JWT sederhana, HANYA untuk admin (pelanggan tidak butuh akun) |
| i18n | next-intl atau solusi ringan setara, default `id`, opsi `en` |
| Deployment target | cPanel dengan Node.js App (Passenger) — **agent harus memastikan struktur build kompatibel dengan model ini** (tidak bergantung pada fitur serverless khusus Vercel seperti Edge Functions/ISR kompleks) |

### Batasan Deployment cPanel (PENTING)
- Jangan gunakan fitur Next.js yang hanya berjalan optimal di platform serverless (Vercel Edge, Middleware kompleks, dsb).
- Gunakan `next start` standar (Node server) yang bisa dijalankan via Passenger.
- Environment variables disimpan di `.env` dan dikonfigurasi manual oleh user saat deploy (jangan hardcode kredensial).
- Upload foto produk: simpan di folder lokal server (`/public/uploads` atau folder terpisah) — bukan cloud storage, karena hosting adalah cPanel shared/VPS sederhana.

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
  /db.ts                     → koneksi MySQL
  /whatsapp.ts               → helper generate wa.me link
  /i18n.ts
/data
  /dummy-products.json       → data dummy untuk development
/public
  /uploads
  /images (aset statis: logo, ornamen Melayu, dll)
```

---

## 4. Konvensi Kode

- Penamaan variabel/fungsi: **Bahasa Inggris** (standar industri), teks yang tampil ke user: **sesuai bahasa aktif (id/en)**.
- Semua teks UI HARUS melalui sistem i18n — jangan hardcode string ke JSX langsung.
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
