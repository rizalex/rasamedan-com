# Product Requirement Document (PRD)
## Website E-commerce Rasa Medan - Oleh-Oleh khas Medan

**Versi:** 1.0
**Tanggal:** 6 Juli 2026
**Status:** Draft untuk pengembangan MVP

---

## 1. Latar Belakang & Tujuan

### 1.1 Latar Belakang
Usaha kecil (UMKM) penjual makanan ringan khas Medan (kue, makanan kering, sirup, dll) membutuhkan kehadiran online yang memungkinkan pelanggan menelusuri produk dengan mudah tanpa hambatan (tanpa wajib login/daftar), sambil tetap mempertahankan proses transaksi yang personal dan fleksibel melalui WhatsApp — sesuai kebiasaan berbisnis UMKM di Indonesia.

### 1.2 Tujuan Produk
- Menyediakan katalog produk online yang menarik dan mudah dijelajahi.
- Mempermudah pelanggan memesan tanpa perlu membuat akun.
- Mengalihkan proses konfirmasi stok, ongkir, dan pembayaran ke WhatsApp (sesuai model bisnis pemilik saat ini).
- Memberi pemilik toko dashboard sederhana untuk mengelola produk & pesanan.
- Memperkuat identitas budaya Melayu/Medan lewat desain visual.

### 1.3 Target Pengguna
| Peran | Deskripsi |
|---|---|
| **Pelanggan** | Pembeli oleh-oleh, browsing tanpa akun, checkout via WhatsApp |
| **Pemilik/Admin** | Mengelola produk, stok, dan status pesanan |

### 1.4 Di Luar Cakupan MVP (Out of Scope)
Untuk menjaga MVP tetap ringkas dan cepat dibangun, fitur berikut **tidak** termasuk di versi awal (dipertimbangkan untuk fase berikutnya):
- Payment gateway otomatis (Midtrans/Xendit, dsb.)
- Akun/login pelanggan
- Kalkulasi ongkir otomatis via API (RajaOngkir, dll.)
- Ulasan & rating produk
- Kupon/diskon otomatis
- Multi-admin/role management
- Notifikasi email/push
- Galeri multi-foto produk (hanya 1 foto utama per produk di MVP)
- Konten produk dwibahasa (deskripsi produk tetap Bahasa Indonesia; hanya antarmuka/UI yang diterjemahkan ke Inggris)

---

## 2. Alur Bisnis (Business Flow)

```
1. Pelanggan browsing katalog (tanpa login)
2. Pelanggan menambahkan produk ke keranjang (disimpan di browser/local storage)
3. Pelanggan checkout → isi data pengiriman (atau pilih ambil sendiri/pickup)
4. Sistem generate Order ID unik + rangkuman pesanan
5. Sistem membuka WhatsApp (wa.me) dengan pesan otomatis terisi (daftar barang, jumlah, data pengiriman)
6. Pelanggan kirim pesan WhatsApp ke pemilik
7. Pemilik memeriksa stok aktual
8. Pemilik menghitung total + biaya ongkir (jika kurir) via WhatsApp
9. Pemilik mengirim QR/rekening pembayaran
10. Pelanggan membayar (QR statis atau transfer bank)
11. Pemilik memverifikasi pembayaran secara manual
12. Pemilik update status pesanan di dashboard admin (mis. "Pembayaran Diverifikasi")
13. Pesanan dikemas
14. Pesanan dikirim (H+1) atau diambil sendiri oleh pelanggan
15. Pesanan selesai — status "Selesai" di sistem
```

### 2.1 Status Pesanan (Order Status)
Status ini disimpan di sistem dan bisa dilihat pelanggan lewat halaman "Cek Pesanan":

| Status | Keterangan |
|---|---|
| `Menunggu Konfirmasi` | Pesanan baru dibuat, belum diproses pemilik |
| `Stok Dikonfirmasi` | Pemilik sudah cek stok tersedia |
| `Menunggu Pembayaran` | Total (+ongkir jika ada) sudah dikirim ke pelanggan |
| `Pembayaran Diverifikasi` | Pemilik sudah cek bukti transfer/QR |
| `Dikemas` | Barang sedang disiapkan |
| `Dikirim` | Sudah diserahkan ke kurir (jika opsi kirim) |
| `Siap Diambil` | Sudah siap untuk pickup (jika opsi ambil sendiri) |
| `Selesai` | Pesanan diterima pelanggan |
| `Dibatalkan` | Pesanan batal (stok habis/pelanggan batal, dll.) |

---

## 3. Fitur MVP

### 3.1 Halaman Beranda (Homepage)
- Hero section dengan identitas visual Melayu/Medan (warna, ornamen ringan).
- Highlight kategori: Kue, Makanan Kering, Sirup, dll.
- Produk unggulan/terlaris (opsional, bisa manual dipilih admin).
- Banner info: estimasi pengiriman H+1, opsi ambil sendiri tersedia.
- Switch bahasa ID/EN di header.

### 3.2 Katalog Produk
- Grid produk dengan foto utama, nama, harga, badge status stok.
- **Filter kategori**: Kue, Kering, Sirup (dan kategori lain yang relevan).
- **Search bar** berbasis nama produk.
- Sort (opsional): harga terendah/tertinggi, terbaru.
- Badge status stok pada setiap kartu produk:
  - 🟢 Tersedia
  - 🟡 Terbatas
  - 🔵 Pre-order
  - ⚪ Tanyakan Stok via WhatsApp

### 3.3 Halaman Detail Produk
- 1 foto utama produk.
- Nama, harga, kategori, status stok.
- Label **Halal** (ikon/badge jika berlaku).
- **Variasi produk** (misal rasa/ukuran) — dropdown atau pilihan chip.
- **Deskripsi produk** (bahan-bahan, cara penyimpanan, dll) — tetap Bahasa Indonesia.
- Tombol "Tambah ke Keranjang".
- Jika stok "Tanyakan via WhatsApp" → tombol langsung membuka WhatsApp dengan pesan tanya stok otomatis.

### 3.4 Keranjang Belanja (Cart)
- Disimpan di local storage browser (tanpa akun/login).
- Tampilkan daftar item, variasi, jumlah, subtotal.
- Bisa ubah jumlah/hapus item.
- Tombol "Checkout".

### 3.5 Checkout
- Pilih metode pengambilan:
  - **Dikirim kurir** → form: nama lengkap penerima, alamat lengkap, kota/kecamatan, catatan lokasi, nomor HP.
  - **Ambil sendiri (pickup)** → form lebih sederhana: nama, nomor HP, estimasi waktu ambil (opsional).
- Ringkasan pesanan (tanpa total ongkir, karena ongkir dihitung manual oleh pemilik via WhatsApp — kecuali pickup, tidak ada ongkir).
- Setelah submit:
  - Sistem generate **Order ID unik** (contoh: `ORD-20260706-0001`).
  - Sistem simpan pesanan dengan status awal `Menunggu Konfirmasi`.
  - Sistem membuka link `wa.me` dengan pesan otomatis terisi (Order ID, daftar barang + variasi + jumlah, metode pengambilan, data pengiriman/nama).

### 3.6 Cek Status Pesanan (Tanpa Akun)
- Halaman khusus: pelanggan input **nomor HP** (dan/atau Order ID) untuk melihat riwayat & status pesanan mereka.
- Menampilkan daftar pesanan dengan status terkini sesuai tabel di bagian 2.1.

### 3.7 Dashboard Admin
- Login khusus admin (username/password sederhana).
- **Kelola Produk**: tambah/edit/hapus produk, upload 1 foto, atur harga, kategori, variasi, deskripsi, label halal, dan **status stok** (Tersedia/Terbatas/Pre-order/Tanya Stok).
- **Kelola Pesanan**: daftar semua pesanan masuk, detail item & data pelanggan, ubah status pesanan (sesuai alur di 2.1).
- Pencarian/filter pesanan berdasarkan status atau nomor HP/Order ID.

### 3.8 Multi-bahasa (ID/EN)
- Toggle bahasa di header, default Bahasa Indonesia.
- Yang diterjemahkan: teks antarmuka (navigasi, tombol, label status, form).
- Deskripsi & nama produk tetap dalam Bahasa Indonesia di MVP ini.

### 3.9 Halaman Pendukung
- **Tentang Kami**: cerita singkat UMKM & asal-usul produk Medan.
- **Kontak**: nomor WhatsApp, alamat toko/pickup point, jam operasional.
- Info kebijakan pengiriman (estimasi H+1) & pengambilan sendiri.

---

## 4. Desain & Identitas Visual

### 4.1 Arahan Warna (Nuansa Melayu/Medan)
- **Emas/Kuning Keemasan** — aksen mewah, khas budaya Melayu.
- **Merah Marun** — warna utama/CTA, melambangkan kehangatan & tradisi.
- **Hijau Tua** — warna sekunder, kesan alami/segar.
- **Krem/Putih Gading** — latar belakang netral agar produk menonjol.
- Ornamen ringan opsional terinspirasi motif Melayu (pucuk rebung, awan larat) sebagai elemen dekoratif di header/footer — tidak mengganggu keterbacaan.

### 4.2 Prinsip UX
- Mobile-first (mayoritas pelanggan akan mengakses & checkout dari HP menuju WhatsApp).
- Navigasi kategori jelas & mudah dijangkau di layar kecil.
- CTA "Pesan via WhatsApp" konsisten dan menonjol di setiap halaman produk.
- Loading cepat, gambar dioptimasi.

---

## 5. Spesifikasi Teknis

### 5.1 Tech Stack
- **Frontend**: Next.js, HTML5, CSS, JavaScript
- **Database**: MySQL
- **Autentikasi Admin**: session/JWT sederhana (hanya untuk admin, bukan pelanggan)
- **Penyimpanan Foto Produk**: folder upload lokal atau storage cloud (disarankan cloud agar scalable, mis. Cloudinary/S3 — keputusan bisa menyesuaikan hosting)
- **Integrasi WhatsApp**: link `wa.me/<nomor>?text=<pesan encoded>` (tanpa API berbayar untuk MVP)

### 5.2 Skema Data Utama (Gambaran Tabel MySQL)
- `products`: id, nama, kategori, harga, deskripsi, bahan, label_halal, status_stok, foto_url, variasi (json/tabel relasi)
- `orders`: id, order_code (Order ID unik), nama_penerima, no_hp, metode_pengambilan (kurir/pickup), alamat, catatan_lokasi, status, total_estimasi, created_at
- `order_items`: id, order_id, product_id, variasi, jumlah, harga_satuan
- `admin_users`: id, username, password_hash

### 5.3 Kebutuhan Non-Fungsional
- Responsif di mobile, tablet, desktop.
- Waktu muat halaman cepat (optimasi gambar & lazy loading).
- Validasi input form (nomor HP, alamat wajib diisi).
- Keamanan dasar: hash password admin, proteksi endpoint admin, sanitasi input.
- Backup database berkala (rekomendasi operasional, di luar cakupan pengembangan awal).

---

## 6. User Stories (Ringkas)

| # | Sebagai | Saya ingin | Agar |
|---|---|---|---|
| 1 | Pelanggan | Melihat semua produk tanpa harus daftar | Bisa langsung belanja tanpa hambatan |
| 2 | Pelanggan | Memfilter produk per kategori & mencari nama produk | Cepat menemukan barang yang dicari |
| 3 | Pelanggan | Menambahkan produk ke keranjang & checkout | Memesan barang dengan mudah |
| 4 | Pelanggan | Memilih ambil sendiri atau dikirim | Sesuai kebutuhan & lokasi saya |
| 5 | Pelanggan | Pesanan otomatis terkirim ke WhatsApp pemilik | Tidak perlu mengetik ulang detail pesanan |
| 6 | Pelanggan | Mengecek status pesanan pakai nomor HP | Tahu progres pesanan tanpa perlu akun |
| 7 | Pemilik | Mengelola produk & stok lewat dashboard | Katalog selalu update |
| 8 | Pemilik | Melihat & mengubah status semua pesanan masuk | Proses pesanan lebih terorganisir |
| 9 | Pelanggan | Mengganti bahasa situs ke Inggris | Bisa memahami situs meski tidak berbahasa Indonesia |

---

## 7. Metrik Keberhasilan MVP (Success Metrics)

- Jumlah pesanan yang berhasil diteruskan ke WhatsApp per minggu.
- Tingkat konversi: pengunjung → checkout selesai.
- Waktu rata-rata pemilik memverifikasi pesanan.
- Tingkat penggunaan fitur cek status pesanan mandiri (mengurangi chat "kak, pesanan saya sampai mana?").

---

## 8. Roadmap Singkat (Setelah MVP)

Fitur yang bisa dipertimbangkan di fase berikutnya:
- Integrasi payment gateway otomatis.
- Kalkulasi ongkir otomatis (integrasi API ekspedisi).
- Galeri multi-foto & video produk.
- Deskripsi produk dwibahasa penuh.
- Sistem akun pelanggan (opsional, tetap pertahankan opsi guest checkout).
- Notifikasi WhatsApp otomatis (via API resmi) untuk update status pesanan.
- Program loyalitas/diskon member.

---

## 9. Revisi & Penambahan Berdasarkan Mockup Visual Terbaru (v1.1)

Berdasarkan referensi desain PNG terbaru, ada beberapa detail baru yang perlu ditambahkan ke scope:

### 9.1 Identitas Brand
- Nama brand: **Rasa Medan**, tagline "Oleh-oleh Khas Medan".
- Logo teks dengan aksen warna emas pada kata "Rasa".

### 9.2 Navigasi Diperluas
- Menu navigasi kini termasuk dropdown untuk "Produk" dan "Kategori", serta menu baru **"Lokasi Toko"**.
- Tombol "Chat via WhatsApp" persisten di header (selalu terlihat, tidak hanya di halaman produk).
- Ikon keranjang di header menampilkan badge jumlah item.

### 9.3 Kategori Diperluas
- Kategori pada mockup: Kue, Camilan, Sirup, Cookies, Oleh-oleh Khas Medan (kategori "Produk Terbatas" pada mockup **tidak perlu dibuat** — diabaikan dari scope, cukup 5 kategori di atas atau sesuai kebutuhan admin ke depannya).
- Ini menegaskan kebutuhan Skill 14 (kategori dinamis) — admin HARUS bisa menambah kategori sendiri, tidak cukup 3 hardcoded seperti asumsi awal.

### 9.4 Section Trust/USP Baru di Beranda
Baris ikon kepercayaan: Halal & BPOM/PIRT, Pesan Tanpa Login, Konfirmasi via WhatsApp, Pengiriman Next-Day, Transaksi Aman — masing-masing dengan judul singkat & deskripsi 1 baris.

### 9.5 Fitur Baru: Lokasi Toko & Peta
- Section baru di beranda: menampilkan nama toko, alamat, embed Google Maps, dan tombol "Buka di Google Maps".

### 9.6 Info Kontak Diperluas di Footer
- Jam Operasional ditampilkan eksplisit (contoh: Senin-Sabtu 09.00-18.00 WIB, Minggu: Tutup/by request).
- Tautan media sosial: Instagram, TikTok, Facebook.

---

*Dokumen ini adalah draft awal dan dapat disesuaikan seiring proses pengembangan.*