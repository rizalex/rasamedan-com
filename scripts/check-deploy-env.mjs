/**
 * Pengaman sebelum `npm run deploy` (Skill 21). Gagal bila konfigurasi build
 * akan menghasilkan Worker production yang salah:
 * - NEXT_PUBLIC_SITE_URL kosong, localhost, atau bukan https — nilai ini
 *   di-inline saat build ke canonical/sitemap dan dipakai cek hostname Turnstile.
 * - TURNSTILE_SITE_KEY kosong atau masih test key di wrangler.jsonc `vars`.
 * - database_id D1 masih placeholder (Skill 24).
 *
 * `npm run preview` tidak memakai skrip ini (preview lokal memang localhost).
 */
import { readFileSync } from "node:fs";

// Next memuat .env saat build; skrip ini membaca nilai yang sama.
const { loadEnvConfig } = await import("@next/env").then((m) => m.default ?? m);
loadEnvConfig(process.cwd(), false);

const problems = [];

const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "";
let url = null;
try {
  url = new URL(raw);
} catch {
  /* dicatat di bawah */
}
if (!url) problems.push(`NEXT_PUBLIC_SITE_URL tidak valid/kosong ("${raw}")`);
else {
  if (url.protocol !== "https:") problems.push(`NEXT_PUBLIC_SITE_URL harus https (sekarang ${url.protocol})`);
  if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    problems.push("NEXT_PUBLIC_SITE_URL masih localhost — isi domain production di .env");
  }
}

// wrangler.jsonc: buang komentar baris `//` sederhana lalu parse.
const jsonc = readFileSync("wrangler.jsonc", "utf8")
  .split("\n")
  .map((line) => line.replace(/^\s*\/\/.*$/, ""))
  .join("\n");
let siteKey = "";
try {
  const config = JSON.parse(jsonc);
  const vars = config.vars ?? {};
  // Binding D1 (Skill 24): database_id placeholder hanya berlaku untuk D1 lokal.
  const d1 = (config.d1_databases ?? []).find((d) => d.binding === "DB");
  if (!d1) problems.push("binding D1 `DB` tidak ada di wrangler.jsonc");
  else if (!d1.database_id || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(d1.database_id)) {
    problems.push(
      "database_id D1 masih placeholder — jalankan `npx wrangler d1 create rasamedan`, salin id-nya ke wrangler.jsonc, lalu `npm run db:migrate:remote`"
    );
  }
  siteKey = vars.TURNSTILE_SITE_KEY ?? "";
  // Flag ini meloloskan test key captcha — hanya untuk preview lokal (.dev.vars).
  if ("ALLOW_TEST_CAPTCHA" in vars) {
    problems.push("ALLOW_TEST_CAPTCHA tidak boleh ada di wrangler.jsonc `vars` (mematikan captcha production)");
  }
} catch {
  problems.push("wrangler.jsonc tidak bisa dibaca untuk memeriksa vars");
}
if (!siteKey) problems.push("TURNSTILE_SITE_KEY di wrangler.jsonc `vars` masih kosong");
else if (/^[123]x0{10,}/.test(siteKey)) problems.push("TURNSTILE_SITE_KEY masih test key");

if (problems.length > 0) {
  console.error("❌ Deploy dibatalkan — konfigurasi production belum benar:");
  for (const p of problems) console.error("   - " + p);
  process.exit(1);
}
console.log(`✅ Konfigurasi deploy OK (${url.hostname}).`);
