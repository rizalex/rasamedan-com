/**
 * Build command untuk Workers Builds (CI Cloudflare) — `npm run ci:build`.
 *
 * Build variables di dashboard berlaku untuk SEMUA branch, padahal
 * `NEXT_PUBLIC_SITE_URL` di-inline saat build (canonical, sitemap, cek hostname
 * Turnstile). Skrip ini memilih nilainya dari branch yang sedang dibangun
 * (`WORKERS_CI_BRANCH`, diisi Workers Builds):
 *   - `main` (atau dijalankan lokal tanpa variabel itu) → production: nilai
 *     `NEXT_PUBLIC_SITE_URL` apa adanya + guard deploy production;
 *   - branch lain (mis. `dev`) → staging: `NEXT_PUBLIC_SITE_URL` diganti
 *     `STAGING_SITE_URL` (Build variable, mis. https://rasa-medan-staging.<sub>.workers.dev).
 * Lalu menjalankan `npm run cf:build` (OpenNext + penyaring rahasia bundle).
 * Deploy command: production `npx wrangler deploy`, non-production
 * `npx wrangler deploy --env staging` (DEPLOYMENT.md §9).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const branch = process.env.WORKERS_CI_BRANCH ?? "";
const isProduction = branch === "" || branch === "main";
const env = { ...process.env };

if (!isProduction) {
  const staging = process.env.STAGING_SITE_URL ?? "";
  let url = null;
  try {
    url = new URL(staging);
  } catch {
    /* dicek di bawah */
  }
  if (!url || url.protocol !== "https:") {
    console.error(`❌ Branch "${branch}" = staging: Build variable STAGING_SITE_URL wajib URL https.`);
    process.exit(1);
  }
  env.NEXT_PUBLIC_SITE_URL = url.origin;
  // database_id staging tidak boleh placeholder (wrangler deploy --env staging).
  const jsonc = readFileSync("wrangler.jsonc", "utf8")
    .split("\n")
    .map((line) => line.replace(/^\s*\/\/.*$/, ""))
    .join("\n");
  const stagingDb = (JSON.parse(jsonc).env?.staging?.d1_databases ?? []).find((d) => d.binding === "DB");
  if (!stagingDb || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(stagingDb.database_id ?? "")) {
    console.error("❌ env.staging: database_id D1 masih placeholder — `npx wrangler d1 create rasamedan-staging`, salin id-nya ke wrangler.jsonc.");
    process.exit(1);
  }
  console.log(`→ Build STAGING untuk branch "${branch}" (${url.origin})`);
} else {
  console.log(`→ Build PRODUCTION${branch ? ` untuk branch "${branch}"` : ""}`);
}

// Tanpa shell: path node berspasi (C:\Program Files\…) aman di Windows.
const run = (args) => {
  const r = spawnSync(process.execPath, args, { stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// Guard production (https, site key, database_id, public/uploads, rahasia di vars).
// Untuk staging guard tetap dijalankan dengan SITE_URL staging: aturannya sama.
run(["scripts/check-deploy-env.mjs"]);
// npm_execpath = npm-cli.js milik npm yang menjalankan skrip ini.
if (!process.env.npm_execpath) {
  console.error("❌ Jalankan lewat `npm run ci:build`.");
  process.exit(1);
}
run([process.env.npm_execpath, "run", "cf:build"]);
