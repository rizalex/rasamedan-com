/**
 * Ubah dump phpMyAdmin (MySQL) → file SQL dialek D1 yang diterima `npm run db:import`.
 * Alternatif `npm run db:export` bila MySQL cPanel tidak bisa disambung langsung.
 *
 * Jalankan:  npm run db:convert -- --in localhost.sql
 *            npm run db:convert -- --in localhost.sql --out db-export/rasamedan-xxx.sql
 *
 * Aturan sama dengan scripts/export-mysql.mjs: id asli dipertahankan, kategori
 * di-upsert per slug, nomor HP seluler dinormalisasi ke 08…, admin_users TIDAK
 * dibawa (buat ulang dengan `npm run seed:admin -- --remote`).
 * Waktu dibaca sebagai UTC (dump phpMyAdmin memuat SET time_zone = "+00:00").
 * File hasil berisi DATA PRIBADI: hanya boleh di db-export/ (di-gitignore).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { sqlValue } from "./lib/d1.mjs";
import { isValidPhone, normalizePhone } from "../lib/phone.mjs";

const ORDER_STATUSES = [
  "Menunggu Konfirmasi", "Stok Dikonfirmasi", "Menunggu Pembayaran", "Pembayaran Diverifikasi",
  "Dikemas", "Dikirim", "Siap Diambil", "Selesai", "Dibatalkan",
];
const STOCK = ["tersedia", "terbatas", "pre-order", "tanya-stok"];
const METHODS = ["kurir", "pickup"];

const args = process.argv.slice(2);
const argVal = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const inArg = argVal("--in");
if (!inArg || inArg.startsWith("--")) {
  console.error("❌ --in wajib, mis. npm run db:convert -- --in localhost.sql");
  process.exit(1);
}
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*$/, "");
const exportDir = resolve("db-export");
const outFile = resolve(argVal("--out") ?? `db-export/rasamedan-${stamp}.sql`);
if (!outFile.startsWith(exportDir + sep) || !outFile.endsWith(".sql")) {
  console.error("❌ --out harus file .sql di dalam db-export/");
  process.exit(1);
}

let dump;
try {
  dump = readFileSync(resolve(inArg), "utf8");
} catch {
  console.error(`❌ File tidak bisa dibaca: ${resolve(inArg)}`);
  process.exit(1);
}

// ---- Parser INSERT MySQL (string '..' dengan \ dan '' sebagai escape) ----
const ESC = { n: "\n", r: "\r", t: "\t", "0": "\u0000", b: "\b", Z: "\u001a" };

/** Baca semua `INSERT INTO `t` (`a`,`b`) VALUES (...),(...);` → { tabel: [ {kolom: nilai} ] }. */
function parseInserts(text) {
  const tables = {};
  const head = /INSERT INTO `([^`]+)` \(([^)]*)\) VALUES\s*/g;
  let m;
  while ((m = head.exec(text))) {
    const table = m[1];
    const cols = m[2].split(",").map((c) => c.trim().replace(/^`|`$/g, ""));
    let i = head.lastIndex;
    const rows = (tables[table] ??= []);
    for (;;) {
      while (/\s/.test(text[i])) i++;
      if (text[i] !== "(") throw new Error(`${table}: '(' diharapkan di posisi ${i}`);
      i++;
      const vals = [];
      for (;;) {
        while (/\s/.test(text[i])) i++;
        let v;
        if (text[i] === "'") {
          i++;
          let s = "";
          for (;;) {
            const ch = text[i];
            if (ch === undefined) throw new Error(`${table}: string tidak tertutup`);
            if (ch === "\\") {
              const nx = text[i + 1];
              s += nx in ESC ? ESC[nx] : nx;
              i += 2;
            } else if (ch === "'") {
              if (text[i + 1] === "'") { s += "'"; i += 2; } else { i++; break; }
            } else { s += ch; i++; }
          }
          v = s;
        } else {
          const t = /^(NULL|-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)/.exec(text.slice(i, i + 64));
          if (!t) throw new Error(`${table}: nilai tidak dikenal dekat posisi ${i}: ${JSON.stringify(text.slice(i, i + 20))}`);
          v = t[1] === "NULL" ? null : Number(t[1]);
          i += t[1].length;
        }
        vals.push(v);
        while (/\s/.test(text[i])) i++;
        if (text[i] === ",") { i++; continue; }
        if (text[i] === ")") { i++; break; }
        throw new Error(`${table}: ',' atau ')' diharapkan di posisi ${i}`);
      }
      if (vals.length !== cols.length) throw new Error(`${table}: ${vals.length} nilai untuk ${cols.length} kolom`);
      rows.push(Object.fromEntries(cols.map((c, k) => [c, vals[k]])));
      while (/\s/.test(text[i])) i++;
      if (text[i] === ",") { i++; continue; }
      if (text[i] === ";") { i++; break; }
      throw new Error(`${table}: ',' atau ';' diharapkan di posisi ${i}`);
    }
    head.lastIndex = i;
  }
  return tables;
}

// ---- Validasi & penulisan, sama dengan export-mysql.mjs ----
/** 'YYYY-MM-DD HH:MM:SS' (UTC) → 'YYYY-MM-DDTHH:MM:SSZ'. */
function isoUtc(s) {
  if (s === null || s === undefined) return null;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(String(s));
  if (!m) throw new Error(`Tanggal tidak valid: ${s}`);
  return `${m[1]}T${m[2]}Z`;
}
const bool01 = (v) => (Number(v) ? 1 : 0);
function nonNegInt(v, what) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${what} bukan bilangan bulat ≥ 0: ${v}`);
  return n;
}
function oneOf(v, list, what) {
  if (!list.includes(v)) throw new Error(`${what} tidak dikenal: ${JSON.stringify(v)}`);
  return v;
}
let nulStripped = 0;
function exportValue(v) {
  if (typeof v !== "string") return sqlValue(v);
  let s = v;
  if (s.includes("\u0000")) { s = s.replaceAll("\u0000", ""); nulStripped++; }
  return `CAST(X'${Buffer.from(s, "utf8").toString("hex")}' AS TEXT)`;
}
const MAX_STATEMENT = 90_000;
function insert(table, cols, values) {
  const stmt = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${values.map(exportValue).join(", ")});`;
  if (Buffer.byteLength(stmt) > MAX_STATEMENT) {
    throw new Error(`${table} #${values[0]} terlalu panjang untuk satu statement D1`);
  }
  return stmt;
}

try {
  const t = parseInserts(dump);
  const categories = (t.categories ?? []).sort((a, b) => a.id - b.id);
  const products = (t.products ?? []).sort((a, b) => a.id - b.id);
  const variants = (t.product_variants ?? []).sort((a, b) => a.id - b.id);
  const orders = (t.orders ?? []).sort((a, b) => a.id - b.id);
  const items = (t.order_items ?? []).sort((a, b) => a.id - b.id);
  const admins = (t.admin_users ?? []).length;

  const catSlugs = new Set(categories.map((c) => String(c.slug).toLowerCase()));
  const orphanCat = products.filter((p) => !catSlugs.has(String(p.category).toLowerCase()));
  if (orphanCat.length > 0) {
    throw new Error(
      `Produk dengan kategori tidak terdaftar: ${orphanCat.map((p) => `#${p.id} (${p.category})`).join(", ")} — perbaiki di admin lalu ekspor ulang`
    );
  }
  const productIds = new Set(products.map((p) => p.id));
  const orderIds = new Set(orders.map((o) => o.id));
  for (const v of variants) if (!productIds.has(v.product_id)) throw new Error(`variant #${v.id}: product_id ${v.product_id} tidak ada`);
  for (const it of items) {
    if (!orderIds.has(it.order_id)) throw new Error(`order_item #${it.id}: order_id ${it.order_id} tidak ada`);
    if (it.product_id !== null && !productIds.has(it.product_id)) throw new Error(`order_item #${it.id}: product_id ${it.product_id} tidak ada`);
  }

  const lines = [];
  for (const c of categories) {
    lines.push(
      `INSERT INTO categories (name, slug, created_at) VALUES (${[c.name, c.slug, isoUtc(c.created_at)]
        .map(exportValue).join(", ")}) ON CONFLICT (slug) DO UPDATE SET name = excluded.name;`
    );
  }
  for (const p of products) {
    lines.push(insert("products",
      ["id", "slug", "name", "category", "price", "weight_grams", "stock_status", "is_halal",
        "description", "ingredients", "image", "is_featured", "created_at", "updated_at"],
      [nonNegInt(p.id, "products.id"), p.slug, p.name, p.category, nonNegInt(p.price, "price"),
        nonNegInt(p.weight_grams, "weight_grams"), oneOf(p.stock_status, STOCK, "stock_status"),
        bool01(p.is_halal), p.description, p.ingredients, p.image, bool01(p.is_featured),
        isoUtc(p.created_at), isoUtc(p.updated_at)]));
  }
  for (const v of variants) {
    lines.push(insert("product_variants",
      ["id", "product_id", "name", "price_delta", "weight_grams", "position"],
      [nonNegInt(v.id, "variant.id"), nonNegInt(v.product_id, "variant.product_id"), v.name,
        Math.trunc(Number(v.price_delta)), nonNegInt(v.weight_grams, "variant.weight_grams"),
        nonNegInt(v.position, "variant.position")]));
  }
  let phonesNormalized = 0;
  for (const o of orders) {
    const norm = normalizePhone(String(o.phone ?? ""));
    const phone = isValidPhone(norm) && norm.startsWith("08") ? norm : o.phone;
    if (phone !== o.phone) phonesNormalized++;
    lines.push(insert("orders",
      ["id", "order_code", "recipient_name", "phone", "fulfillment_method", "address", "city",
        "location_note", "status", "total_estimate", "note", "created_at", "updated_at"],
      [nonNegInt(o.id, "orders.id"), o.order_code, o.recipient_name, phone,
        oneOf(o.fulfillment_method, METHODS, "fulfillment_method"), o.address, o.city,
        o.location_note, oneOf(o.status, ORDER_STATUSES, "status"),
        o.total_estimate === null ? null : nonNegInt(o.total_estimate, "total_estimate"),
        o.note, isoUtc(o.created_at), isoUtc(o.updated_at)]));
  }
  for (const it of items) {
    lines.push(insert("order_items",
      ["id", "order_id", "product_id", "product_name", "variant", "quantity", "unit_price"],
      [nonNegInt(it.id, "item.id"), nonNegInt(it.order_id, "item.order_id"),
        it.product_id === null ? null : nonNegInt(it.product_id, "item.product_id"),
        it.product_name, it.variant, nonNegInt(it.quantity, "quantity"),
        nonNegInt(it.unit_price, "unit_price")]));
  }

  const manifest = {
    exported_at: new Date().toISOString(),
    categories: categories.length,
    products: products.length,
    product_variants: variants.length,
    orders: orders.length,
    order_items: items.length,
  };
  const header = [
    "-- Konversi dump phpMyAdmin → D1 (scripts/convert-phpmyadmin.mjs).",
    "-- BERISI DATA PRIBADI PELANGGAN — jangan di-commit/dibagikan; hapus setelah impor.",
    "-- Impor: npm run db:import -- --file <file ini> [--remote]",
    `-- manifest: ${JSON.stringify(manifest)}`,
  ];
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, header.join("\n") + "\n" + lines.join("\n") + "\n", { mode: 0o600 });

  console.log(`✅ Konversi selesai → ${outFile}`);
  for (const [k, v] of Object.entries(manifest)) if (k !== "exported_at") console.log(`   ${k}: ${v}`);
  console.log(`   nomor HP dinormalisasi ke 08…: ${phonesNormalized}`);
  if (nulStripped > 0) console.log(`   ⚠ nilai berisi NUL byte (dibuang): ${nulStripped}`);
  console.log(`ℹ️  admin_users (${admins}) tidak dibawa — buat ulang: ADMIN_PASSWORD=... npm run seed:admin -- --remote`);
} catch (err) {
  console.error("❌ Konversi gagal:", err?.message ?? err);
  process.exitCode = 1;
}
