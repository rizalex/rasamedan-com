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
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const FILE = resolve(".open-next/cloudflare/next-env.mjs");

// Non-rahasia yang boleh ikut ter-bundle. NEXT_PUBLIC_* memang sudah publik
// (di-inline ke JS klien). Site key captcha sengaja TIDAK diizinkan: nilai .env
// lokal (sering test key) akan diam-diam terpakai di production bila var
// production lupa diisi — isi lewat "vars" wrangler/dashboard.
const isAllowed = (key) =>
  key.startsWith("NEXT_PUBLIC_") ||
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

// Salinan .env yang ditaruh OpenNext/Next di output (tidak ikut bundle Worker,
// tapi berisi rahasia lokal) — hapus agar folder .open-next aman dibagikan/zip.
for (const stray of [
  ".open-next/server-functions/default/.env",
  ".open-next/server-functions/default/.env.local",
]) {
  if (existsSync(stray)) rmSync(stray);
}

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
