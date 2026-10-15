/**
 * Helper skrip Node untuk D1 (Skill 24): menjalankan SQL lewat
 * `wrangler d1 execute`, default ke D1 LOKAL (.wrangler/state). Target remote
 * (production) hanya bila argumen `--remote` diberikan secara eksplisit.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const DB_NAME = "rasamedan";
const WRANGLER = resolve("node_modules/wrangler/bin/wrangler.js");

/** "--remote" bila diminta lewat argumen, selain itu "--local". */
export function targetFromArgs(argv = process.argv) {
  return argv.includes("--remote") ? "--remote" : "--local";
}

function wrangler(args) {
  const r = spawnSync(process.execPath, [WRANGLER, "d1", "execute", DB_NAME, ...args, "--json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) {
    // Tampilkan pesan wrangler apa adanya (tanpa nilai parameter: SQL ada di file).
    // Baris yang memuat deret heksadesimal panjang (mis. potongan hash password
    // di pesan syntax error) tidak dicetak.
    const detail = (r.stderr || r.stdout || "")
      .trim()
      .split("\n")
      .slice(-6)
      .map((line) => (/[0-9a-f]{32,}/i.test(line) ? "[baris disembunyikan]" : line))
      .join("\n");
    throw new Error(`wrangler d1 execute gagal (exit ${r.status}):\n${detail}`);
  }
  // Impor remote mencetak baris progres ("├ Checking…") sebelum JSON: ambil
  // mulai dari baris pertama yang diawali [ atau {.
  const out = r.stdout;
  const start = out.search(/^[\[{]/m);
  return JSON.parse(start >= 0 ? out.slice(start) : out);
}

/** Jalankan satu SELECT kecil (lewat --command) dan kembalikan barisnya. */
export function d1Query(sql, target) {
  const out = wrangler([target, "--command", sql]);
  return out[0]?.results ?? [];
}

/**
 * Jalankan banyak statement dari teks SQL (lewat --file sementara, agar nilai
 * seperti hash password tidak muncul di argumen proses). File dihapus setelahnya.
 */
export function d1ExecSql(sqlText, target) {
  const dir = mkdtempSync(join(tmpdir(), "rasamedan-d1-"));
  const file = join(dir, "run.sql");
  try {
    writeFileSync(file, sqlText, { encoding: "utf8", mode: 0o600 });
    return wrangler([target, "--file", file, "--yes"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Jalankan file SQL yang sudah ada di disk apa adanya (tanpa salinan sementara). */
export function d1ExecFile(path, target) {
  return wrangler([target, "--file", path, "--yes"]);
}

/** Literal SQL aman untuk nilai string/angka/null (escape kutip tunggal). */
export function sqlValue(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error(`Angka tidak valid: ${v}`);
    return String(v);
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}
