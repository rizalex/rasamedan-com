import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dijalankan di Cloudflare Workers via @opennextjs/cloudflare (CLAUDE.md §2).
  // Jangan tambahkan runtime "edge", middleware kompleks, atau ISR.
  reactStrictMode: true,

  // Kunci root tracing ke folder proyek: ada package-lock.json di folder induk
  // (di luar repo) yang membuat Next salah menebak workspace root, sehingga
  // output standalone untuk OpenNext bisa ber-path salah.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),

  // Nonaktifkan optimasi gambar bawaan Next agar tidak butuh binary native `sharp`
  // (tidak tersedia di Workers; Cloudflare Images berbayar). Foto disajikan apa adanya.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
