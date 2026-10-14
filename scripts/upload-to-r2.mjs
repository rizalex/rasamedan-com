/**
 * Unggah foto produk lama (era cPanel `public/uploads/`) ke R2 (Skill 27).
 * Kunci objek = `uploads/<nama file>`, sehingga URL `/uploads/<nama file>` di
 * kolom `products.image` tetap valid tanpa migrasi data.
 *
 * Jalankan (--dir WAJIB, folder di luar public/):
 *   npm run uploads:r2 -- --dir <folder>             (R2 LOKAL, untuk uji)
 *   npm run uploads:r2 -- --dir <folder> --remote    (R2 production)
 *   tambahkan --dry-run untuk melihat daftar tanpa mengunggah.
 * Untuk cutover: unduh folder public/uploads dari cPanel (File Manager →
 * Compress → Download), ekstrak ke folder di LUAR proyek (mis. ../foto-cpanel),
 * lalu arahkan --dir ke sana. Symlink dilewati.
 *
 * Pengaman: hanya file gambar yang lolos cek magic bytes (sama dengan route
 * upload) dan bernama aman yang diunggah; Content-Type diambil dari hasil
 * deteksi, bukan dari ekstensi. Subfolder ikut (maks kedalaman route /uploads).
 */
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { detectImageType } from "../lib/image-type.mjs";
import { MAX_UPLOAD_SEGMENTS, objectKeyFromSegments } from "../lib/upload-path.mjs";

const BUCKET = "rasa-medan-uploads";
const WRANGLER = resolve("node_modules/wrangler/bin/wrangler.js");
const MAX_BYTES = 10 * 1024 * 1024; // longgar untuk foto lama; route upload baru tetap 2 MB

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const remote = args.includes("--remote");
const dryRun = args.includes("--dry-run");
// --dir wajib dan tidak boleh di dalam public/: isi public/ ikut ter-deploy
// sebagai aset statis yang menimpa route /uploads (audit Skill 27).
const dirArg = argValue("--dir");
if (!dirArg || dirArg.startsWith("--")) {
  console.error("❌ --dir wajib, mis. --dir ../foto-cpanel (folder di LUAR public/)");
  process.exit(1);
}
const dir = resolve(dirArg);
if (!existsSync(dir) || !statSync(dir).isDirectory()) {
  console.error(`❌ Folder tidak ditemukan: ${dir}`);
  process.exit(1);
}
// realpath (ikuti junction/symlink) + huruf kecil di Windows (path tidak peka huruf).
const norm = (p) => {
  const real = realpathSync.native(p);
  return process.platform === "win32" ? real.toLowerCase() : real;
};
const realDir = norm(dir);
const publicDir = norm("public");
if (realDir === publicDir || realDir.startsWith(publicDir + sep)) {
  console.error("❌ Jangan memakai folder di dalam public/ — pindahkan foto ke folder di luar proyek/public dulu.");
  process.exit(1);
}

function* walk(root, depth = 1) {
  for (const name of readdirSync(root)) {
    const full = join(root, name);
    // lstat: symlink dilewati (jangan ikut mengunggah file di luar folder sumber).
    const st = lstatSync(full);
    if (st.isSymbolicLink()) {
      console.warn(`  ⚠ lewati (symlink): ${relative(dir, full)}`);
      continue;
    }
    if (st.isDirectory()) {
      if (depth < MAX_UPLOAD_SEGMENTS) yield* walk(full, depth + 1);
    } else if (st.isFile()) {
      yield full;
    }
  }
}

let uploaded = 0;
let skipped = 0;
let failed = 0;
console.log(`→ Sumber: ${dir} → R2 ${BUCKET} (${remote ? "REMOTE/production" : "lokal"})${dryRun ? " [dry-run]" : ""}`);

for (const file of walk(dir)) {
  const rel = relative(dir, file).split(sep);
  const name = rel.join("/");
  if (rel[rel.length - 1] === ".gitkeep") continue;
  // Aturan sama dengan route penyaji (lib/upload-path.mjs): nama lain tidak bisa diakses.
  if (!objectKeyFromSegments(rel)) {
    console.warn(`  ⚠ lewati (nama tidak aman): ${name}`);
    skipped++;
    continue;
  }
  const bytes = readFileSync(file);
  if (bytes.byteLength > MAX_BYTES) {
    console.warn(`  ⚠ lewati (terlalu besar): ${name}`);
    skipped++;
    continue;
  }
  const kind = detectImageType(new Uint8Array(bytes));
  if (!kind) {
    console.warn(`  ⚠ lewati (bukan JPG/PNG/WEBP/GIF): ${name}`);
    skipped++;
    continue;
  }
  if (dryRun) {
    console.log(`  · ${name} (${kind.mime})`);
    uploaded++;
    continue;
  }
  const r = spawnSync(
    process.execPath,
    [
      WRANGLER, "r2", "object", "put", `${BUCKET}/uploads/${name}`,
      "--file", file, "--content-type", kind.mime, remote ? "--remote" : "--local",
    ],
    { encoding: "utf8" }
  );
  if (r.status === 0) {
    console.log(`  ✓ ${name}`);
    uploaded++;
  } else {
    console.error(`  ✗ ${name}: ${(r.stderr || r.stdout || "").trim().split("\n").slice(-2).join(" ")}`);
    failed++;
  }
}

console.log(`Selesai: ${uploaded} ${dryRun ? "akan diunggah" : "diunggah"}, ${skipped} dilewati, ${failed} gagal.`);
process.exit(failed > 0 ? 1 : 0);
