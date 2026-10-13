/**
 * Jalankan SETELAH `opennextjs-cloudflare build`, SEBELUM preview/deploy.
 *
 * OpenNext menyalin isi semua file `.env*` ke `.open-next/cloudflare/next-env.mjs`,
 * yang ikut di-bundle wrangler ke Worker. Tanpa skrip ini, rahasia di `.env`
 * lokal (secret sesi, password DB, secret captcha) ikut ter-upload saat deploy.
 *
 * Skrip ini menulis ulang file itu dan HANYA menyisakan variabel non-rahasia
 * (allowlist). Rahasia runtime wajib datang dari `wrangler secret put`
 * (production) atau `.dev.vars` (lokal) — lihat CLAUDE.md §2.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const FILE = resolve(".open-next/cloudflare/next-env.mjs");

// Non-rahasia yang boleh ikut ter-bundle. NEXT_PUBLIC_* memang sudah publik
// (di-inline ke JS klien), sisanya site key/verifikasi yang tampil di HTML.
const isAllowed = (key) =>
  key.startsWith("NEXT_PUBLIC_") ||
  key === "RECAPTCHA_SITE_KEY" ||
  key === "TURNSTILE_SITE_KEY" ||
  key === "GOOGLE_SITE_VERIFICATION" ||
  key === "NODE_ENV";

if (!existsSync(FILE)) {
  console.error(`[strip-bundle-secrets] ${FILE} tidak ada — jalankan build OpenNext dulu.`);
  process.exit(1);
}

const mod = await import(`${pathToFileURL(FILE).href}?t=${Date.now()}`);
const removed = new Set();
let out = "// Disaring oleh scripts/strip-bundle-secrets.mjs — hanya variabel non-rahasia.\n";
for (const mode of ["production", "development", "test"]) {
  const vars = mod[mode] ?? {};
  const kept = {};
  for (const [key, value] of Object.entries(vars)) {
    if (isAllowed(key)) kept[key] = value;
    else removed.add(key);
  }
  out += `export const ${mode} = ${JSON.stringify(kept)};\n`;
}
writeFileSync(FILE, out);

// Verifikasi: file hasil tidak boleh lagi memuat kunci yang dibuang.
const check = readFileSync(FILE, "utf8");
const leaked = [...removed].filter((k) => check.includes(`"${k}"`));
if (leaked.length > 0) {
  console.error(`[strip-bundle-secrets] GAGAL: masih ada ${leaked.join(", ")}`);
  process.exit(1);
}
console.log(
  `[strip-bundle-secrets] OK — ${removed.size} variabel non-publik dibuang dari bundle` +
    (removed.size ? `: ${[...removed].sort().join(", ")}` : "")
);
