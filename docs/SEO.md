# Panduan SEO Rasa Medan (Skill 33)

Target pencarian: **"toko oleh-oleh khas Medan"**, "oleh-oleh Medan", "oleh-oleh Sumatera Utara",
"oleh-oleh dekat Bandara Kualanamu", serta nama produk (Bika Ambon, Kacang Sihobuk, Sirup Markisa, …).

Tidak ada yang bisa menjamin posisi #1 di Google. Untuk pencarian lokal seperti "toko oleh-oleh
Medan", Google menampilkan **peta + 3 toko (Local Pack)** di atas hasil web — urutannya ditentukan
terutama oleh **profil Google Business**, ulasan, dan kedekatan lokasi, bukan oleh kode situs saja.
Bagian A sudah dikerjakan di kode; bagian B–D harus dikerjakan pemilik dan justru paling berpengaruh.

## A. Sudah ada di situs (kode)

- Judul & meta description per halaman berisi kata kunci (beranda: "Toko Oleh-oleh Khas Medan,
  Sumatera Utara | Rasa Medan"); H1 beranda = kata kunci utama.
- Teks yang bisa diindeks di beranda (paragraf tentang toko + FAQ 5 pertanyaan).
- Structured Data (JSON-LD): `Store` (alamat lengkap Tanjung Morawa 20552, jam buka, telepon,
  area layanan, peta), `WebSite`, `FAQPage`, `Product` (harga & stok), `BreadcrumbList`.
- `sitemap.xml` (beranda, katalog, kategori, semua produk) & `robots.txt`; halaman transaksi noindex.
- Canonical, Open Graph (pratinjau WhatsApp/Facebook), HTTPS, `lang="id"`, ramah ponsel.

Konten alamat/jam diambil dari `data/site-info.json` — ubah di sana bila pindah/ganti jam, dan
**samakan persis** dengan profil Google Business (lihat B).

## B. Google Business Profile — paling penting (± 1 jam, sekali)

1. Buka <https://business.google.com> → tambahkan bisnis **"Rasa Medan - Oleh-oleh Khas Medan"**
   (nama boleh memuat deskripsi singkat hanya bila memang nama papan toko; jika tidak, cukup "Rasa Medan").
2. Kategori utama: **Toko Oleh-oleh** (*Souvenir store*); kategori tambahan: *Toko Kue*,
   *Toko Makanan Ringan*, *Toko Makanan Khas*.
3. Alamat: **sama persis** dengan situs: Jl. Bandara Kuala Namu – Tj. Morawa (sebelum gate bandara),
   Sumatera Utara 20552. Letakkan pin tepat di toko.
4. Jam buka (Kamis–Selasa 08.00–17.00, Rabu tutup), nomor WhatsApp, situs `https://rasamedan.com`.
5. Verifikasi (kartu pos/video/telepon sesuai pilihan Google).
6. Unggah **minimal 10 foto asli**: tampak depan toko, papan nama, etalase, setiap produk, kemasan.
   Tambah foto baru tiap bulan.
7. Isi **Produk** di profil (nama, harga, foto, tautan ke `rasamedan.com/produk/<slug>`).
8. Tulis deskripsi (750 karakter) memuat: oleh-oleh khas Medan, Bika Ambon, Kacang Sihobuk, Sirup
   Markisa, dekat Bandara Kualanamu, kirim ke seluruh Indonesia.
9. Aktifkan tombol **Chat/WhatsApp** dan **Pesan online** → tautan situs.

## C. Ulasan (faktor peringkat lokal terbesar setelah relevansi & jarak)

- Minta setiap pembeli puas memberi ulasan Google: kirim tautan ulasan (*Profil → Minta ulasan*)
  di WhatsApp setelah pesanan selesai. Target: 20+ ulasan dalam 3 bulan, lalu rutin.
- Balas **semua** ulasan (termasuk yang buruk) dengan sopan, sebut nama produk secara alami.
- Jangan membeli/memalsukan ulasan — melanggar kebijakan Google dan bisa membuat profil ditangguhkan.

## D. Google Search Console & lainnya

1. <https://search.google.com/search-console> → tambah properti **Domain** `rasamedan.com`
   (verifikasi DNS TXT di Cloudflare — cara termudah). Alternatif: isi Build variable
   `GOOGLE_SITE_VERIFICATION` lalu deploy ulang.
2. *Sitemaps* → kirim `https://rasamedan.com/sitemap.xml`.
3. *URL Inspection* → minta pengindeksan untuk beranda, `/produk`, `/kontak`.
4. Pantau *Performance* (kata kunci & klik) tiap bulan; produk yang sering dicari → beri deskripsi
   lebih lengkap di admin.
5. Daftarkan juga di **Bing Webmaster Tools** (bisa impor dari Search Console).
6. **NAP konsisten** (Nama, Alamat, Telepon sama persis) di: Instagram, TikTok, Facebook, Tokopedia/
   Shopee (bila ada), Google Maps, direktori lokal. Cantumkan tautan `rasamedan.com` di semua bio.
7. **Tautan masuk (backlink)**: ajak blog kuliner/travel Medan, akun wisata Sumut, atau mitra
   (hotel/travel dekat Kualanamu) menautkan ke situs. Satu tautan dari situs lokal relevan lebih
   bernilai dari puluhan tautan acak.

## E. Konten berkelanjutan (di admin, tanpa coding)

- Setiap produk: **deskripsi unik 80–150 kata** (asal-usul, rasa, bahan, daya tahan, cara simpan,
  cocok untuk oleh-oleh siapa). Hindari menyalin dari situs lain.
- Nama produk memuat kata yang dicari orang, mis. "Bika Ambon Medan Original" daripada "Original".
- Foto produk asli (bukan stok/AI), latar bersih, nama file deskriptif sebelum diunggah
  (`bika-ambon-medan.jpg`).
- Foto/gambar yang memuat merek toko lain sebaiknya diganti foto produk sendiri (lihat SKILLS 19).

## F. Yang diukur

| Metrik | Alat | Target awal |
|---|---|---|
| Posisi "oleh-oleh khas Medan" | Search Console → Performance | masuk halaman 1 dalam 3–6 bulan |
| Tampil di Local Pack "toko oleh-oleh Medan" / "oleh-oleh Kualanamu" | Google Business → Performa | muncul untuk pencarian sekitar toko & bandara |
| Ulasan Google | Google Business | 20+ ulasan, rata-rata ≥ 4,5 |
| Klik ke situs & WhatsApp | Google Business + Search Console | naik tiap bulan |
