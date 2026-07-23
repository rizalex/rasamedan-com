/** @type {import('next').NextConfig} */
const nextConfig = {
  // Menjaga kompatibilitas dengan cPanel + Passenger (Node server via `next start`).
  // Jangan tambahkan fitur yang hanya berjalan di platform serverless (Edge, ISR kompleks).
  reactStrictMode: true,

  // Nonaktifkan optimasi gambar bawaan Next agar tidak butuh binary native `sharp`
  // yang sulit di-compile di shared hosting. Foto produk disajikan apa adanya.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
