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

const dev = process.env.NODE_ENV !== "production";
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
