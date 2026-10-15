import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const isDev = process.env.NODE_ENV !== "production";

// `next dev`: sediakan binding wrangler.jsonc (D1 lokal di .wrangler/state) ke
// getCloudflareContext() — Skill 24. Tidak dijalankan saat `next build`.
// Isi DB lokal dulu: npm run db:migrate (lalu seed, lihat README).
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

/**
 * Origin iframe Google Maps (Skill 18) untuk CSP frame-src. Dibaca saat build,
 * sama seperti NEXT_PUBLIC_* lain yang di-inline — mengganti URL peta = build ulang.
 */
function mapsOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_MAPS_EMBED_URL ?? "").origin;
  } catch {
    return "https://www.google.com";
  }
}

/**
 * Content-Security-Policy (Skill 21.2 no. 8). Tanpa middleware/nonce (CLAUDE.md §2),
 * jadi script-src butuh 'unsafe-inline' untuk skrip inline App Router; style-src
 * butuh 'unsafe-inline' untuk atribut style=. Sumber eksternal yang diizinkan hanya
 * Cloudflare Turnstile dan iframe peta. Link wa.me/sosial adalah navigasi (bukan
 * resource) sehingga tidak diatur CSP. JSON-LD tidak dieksekusi.
 * Catatan cutover (Skill 30): fitur zona Cloudflare yang menyuntik skrip (Rocket
 * Loader, Email Obfuscation, Web Analytics) akan diblokir — matikan atau izinkan.
 */
function contentSecurityPolicy() {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    `frame-src https://challenges.cloudflare.com ${mapsOrigin()}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  if (!isDev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

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

  // Header keamanan untuk semua respons dari aplikasi (OpenNext menerapkannya di
  // Worker). HSTS diatur di dashboard Cloudflare saat cutover (Skill 30).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
