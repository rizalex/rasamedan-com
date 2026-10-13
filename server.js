/**
 * Custom server Next.js untuk cPanel + Phusion Passenger.
 * Passenger menjalankan file ini sebagai "Application startup file" dan
 * menyediakan port lewat process.env.PORT. `npm start` (next start) tetap
 * bisa dipakai untuk menjalankan produksi secara manual.
 *
 * Jalankan manual:  node server.js   (butuh `next build` lebih dulu)
 */
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
// @next/env adalah dependensi bawaan `next`; di-resolve dari lokasi paket next
// agar tetap ketemu walau tidak di-hoist (mis. layout pnpm).
const { loadEnvConfig } = require(
  require.resolve("@next/env", { paths: [require.resolve("next")] })
);

const dev = process.env.NODE_ENV !== "production";

// Muat .env SEBELUM pengecekan di bawah (Next sendiri baru memuatnya saat
// app.prepare()), agar secret yang ditaruh di file .env ikut terbaca.
loadEnvConfig(process.cwd(), dev);

// Fail-fast: file ini hanya dipakai di server (lokal pakai `npm run dev`).
// Lupa set "Application mode = Production" di cPanel → Next jalan mode dev
// (cookie tidak `secure`, stack trace terbuka). Tolak kecuali disengaja.
if (dev && process.env.ALLOW_DEV_SERVER !== "1") {
  console.error(
    "NODE_ENV bukan 'production'. Set Application mode = Production di cPanel " +
      "(atau ALLOW_DEV_SERVER=1 bila memang disengaja)."
  );
  process.exit(1);
}
if (!dev && (process.env.ADMIN_SESSION_SECRET || "").length < 32) {
  console.error("ADMIN_SESSION_SECRET wajib diisi minimal 32 karakter.");
  process.exit(1);
}

const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  }).listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`> Rasa Medan berjalan di http://${hostname}:${port}`);
  });
});
