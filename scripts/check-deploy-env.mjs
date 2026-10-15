/**
 * Pengaman sebelum `npm run deploy` (Skill 21). Gagal bila konfigurasi build
 * akan menghasilkan Worker production yang salah:
 * - NEXT_PUBLIC_SITE_URL kosong, localhost, atau bukan https — nilai ini
 *   di-inline saat build ke canonical/sitemap dan dipakai cek hostname Turnstile.
 * - TURNSTILE_SITE_KEY kosong atau masih test key di wrangler.jsonc `vars`.
 * - database_id D1 masih placeholder (Skill 24).
 * - rahasia di `vars` (termasuk env.*.vars), TRUST_CF_CONNECTING_IP bukan "1", atau
 *   NEXT_PUBLIC_* bernama rahasia (Skill 29).
 * - public/uploads berisi file (Skill 27: akan menimpa route R2 sebagai aset statis).
 *
 * `npm run preview` tidak memakai skrip ini (preview lokal memang localhost).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";

// Next memuat .env saat build; skrip ini membaca nilai yang sama.
const { loadEnvConfig } = await import("@next/env").then((m) => m.default ?? m);
loadEnvConfig(process.cwd(), false);

const problems = [];

// Nama variabel yang berbau rahasia (dipakai untuk `vars` dan NEXT_PUBLIC_*).
// `_KEY` menangkap mis. API_CO_ID_KEY (Skill 22); kunci publik dikecualikan eksplisit.
const SECRET_LIKE = /SECRET|PASSWORD|PASS$|TOKEN|PRIVATE|API_?KEY|_KEY$|CREDENTIAL|AUTH/i;
const PUBLIC_KEY_ALLOWLIST = new Set(["TURNSTILE_SITE_KEY"]);

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
  // Semua blok vars (top-level + env.<nama>.vars) ikut diperiksa.
  const allVars = [vars, ...Object.values(config.env ?? {}).map((e) => e?.vars ?? {})];
  for (const v of allVars) {
    // Flag ini meloloskan test key captcha — hanya untuk preview lokal (.dev.vars).
    if ("ALLOW_TEST_CAPTCHA" in v) {
      problems.push("ALLOW_TEST_CAPTCHA tidak boleh ada di wrangler.jsonc `vars` (mematikan captcha production)");
    }
    // `vars` di-commit ke repo: rahasia di sini = rahasia publik.
    for (const key of Object.keys(v)) {
      if ((SECRET_LIKE.test(key) || key.startsWith("DB_")) && !PUBLIC_KEY_ALLOWLIST.has(key)) {
        problems.push(`${key} tidak boleh di \`vars\` wrangler.jsonc (di-commit) — pakai \`npx wrangler secret put ${key}\``);
      }
    }
  }
  // Tanpa flag ini semua pengunjung berbagi satu ember rate limit (lib/client-ip.ts):
  // satu penyerang bisa mengunci login/cek pesanan/checkout untuk semua orang.
  if (vars.TRUST_CF_CONNECTING_IP !== "1") {
    problems.push('vars.TRUST_CF_CONNECTING_IP harus "1" (IP klien dari edge Cloudflare untuk rate limit)');
  }
} catch {
  problems.push("wrangler.jsonc tidak bisa dibaca untuk memeriksa vars");
}
if (!siteKey) problems.push("TURNSTILE_SITE_KEY di wrangler.jsonc `vars` masih kosong");
else if (/^[123]x0{10,}/.test(siteKey)) problems.push("TURNSTILE_SITE_KEY masih test key");

// Skill 27: isi public/ ikut ter-deploy sebagai aset statis yang dilayani
// SEBELUM Worker — file di public/uploads akan menimpa route R2 /uploads dan
// disajikan tanpa allowlist tipe (risiko XSS bila ada .html/.svg).
if (existsSync("public/uploads") && readdirSync("public/uploads").length > 0) {
  problems.push("public/uploads berisi file — foto produk harus di R2 (npm run uploads:r2 -- --dir <folder di luar public>), lalu kosongkan/hapus folder itu");
}

// NEXT_PUBLIC_* di-inline ke JavaScript klien — nama berbau rahasia hampir pasti salah tempat.
for (const key of Object.keys(process.env)) {
  if (key.startsWith("NEXT_PUBLIC_") && SECRET_LIKE.test(key.slice("NEXT_PUBLIC_".length))) {
    problems.push(`${key}: variabel NEXT_PUBLIC_* terbaca publik di browser — rahasia jangan diberi awalan ini`);
  }
}

// Peringatan (tidak memblokir — staging boleh memakai dummy): nomor WA dummy
// development (CLAUDE.md §6) membuat semua pesanan production nyasar.
const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER ?? "";
if (!waNumber || ["6281200000000", "6281300000000"].includes(waNumber)) {
  console.warn(`⚠️  NEXT_PUBLIC_WA_NUMBER masih kosong/dummy ("${waNumber}") — wajib nomor asli sebelum go-live.`);
}

if (problems.length > 0) {
  console.error("❌ Deploy dibatalkan — konfigurasi production belum benar:");
  for (const p of problems) console.error("   - " + p);
  process.exit(1);
}
console.log(`✅ Konfigurasi deploy OK (${url.hostname}).`);
