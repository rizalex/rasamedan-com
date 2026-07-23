# SKILLS.md
## Breakdown Modul Teknis untuk Claude Code

Dokumen ini memecah pembangunan aplikasi menjadi modul-modul kerja (skill) yang bisa dikerjakan satu per satu oleh agent. Kerjakan berurutan sesuai nomor — tiap modul punya checklist penerimaan (acceptance criteria).

---

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

- Hero section dengan warna tema (lihat `AGENTS.md` bagian 5).
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
