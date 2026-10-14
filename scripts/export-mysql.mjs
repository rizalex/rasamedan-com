/**
 * Ekspor data production MySQL (cPanel) → file SQL dialek SQLite untuk D1
 * (Skill 25). Hasilnya diimpor dengan `npm run db:import`.
 *
 * Persiapan (mysql2 sudah dihapus dari dependensi sejak Skill 24):
 *   npm i --no-save mysql2
 * Kredensial dibaca dari env (mis. `.env`): DB_HOST, DB_PORT, DB_USER,
 * DB_PASS, DB_NAME — paling aman lewat SSH tunnel ke cPanel, atau jalankan
 * dengan user MySQL read-only.
 *
 * Jalankan:  npm run db:export                     → db-export/rasamedan-<waktu>.sql
 *            npm run db:export -- --out <file>
 *
 * Nomor HP pesanan dinormalisasi ke format `08…` (lib/phone.mjs) bila hasilnya
 * valid: pesanan lama yang disimpan sebelum normalisasi (mis. "6281…",
 * "+62 812…") tetap ditemukan Cek Pesanan apa pun format yang diketik
 * pelanggan. Nomor yang tidak valid disimpan apa adanya.
 *
 * Isi: categories (upsert per slug — kategori awal sudah ada dari migrasi),
 * products, product_variants, orders, order_items dengan id ASLI (relasi &
 * Order ID tetap). admin_users SENGAJA tidak diekspor: hash scrypt era cPanel
 * tidak bisa dipakai login di Workers (Skill 26) — buat ulang admin dengan
 * `npm run seed:admin -- --remote` saat cutover.
 *
 * File hasil berisi DATA PRIBADI pelanggan (nama, HP, alamat): folder
 * db-export/ di-gitignore — jangan dibagikan, hapus setelah impor terverifikasi.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { sqlValue } from "./lib/d1.mjs";
import { isValidPhone, normalizePhone } from "../lib/phone.mjs";

const ORDER_STATUSES = [
  "Menunggu Konfirmasi",
  "Stok Dikonfirmasi",
  "Menunggu Pembayaran",
  "Pembayaran Diverifikasi",
  "Dikemas",
  "Dikirim",
  "Siap Diambil",
  "Selesai",
  "Dibatalkan",
];
const STOCK = ["tersedia", "terbatas", "pre-order", "tanya-stok"];
const METHODS = ["kurir", "pickup"];

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*$/, "");
const exportDir = resolve("db-export");
const outFile = resolve(outIdx >= 0 ? args[outIdx + 1] ?? "" : `db-export/rasamedan-${stamp}.sql`);
// File berisi data pribadi: hanya boleh di db-export/ (di-gitignore, tidak
// ter-deploy). Path lain bisa ikut ter-commit atau masuk public/.
if (!outFile.startsWith(exportDir + sep) || !outFile.endsWith(".sql")) {
  console.error("❌ --out harus file .sql di dalam db-export/");
  process.exit(1);
}

// Koneksi tanpa TLS: data pelanggan & handshake password lewat jaringan
// terbuka. Wajib lewat SSH tunnel ke cPanel (DB_HOST=127.0.0.1), mis.:
//   ssh -L 3307:localhost:3306 user@host-cpanel   → DB_HOST=127.0.0.1 DB_PORT=3307
// Host jarak jauh hanya dengan --allow-remote-host, dan TLS terverifikasi wajib.
const dbHost = process.env.DB_HOST ?? "localhost";
const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(dbHost);
const allowRemote = args.includes("--allow-remote-host");
if (!isLocalHost && !allowRemote) {
  console.error(`❌ DB_HOST=${dbHost} bukan localhost. Pakai SSH tunnel (lihat komentar skrip),`);
  console.error("   atau --allow-remote-host (koneksi wajib TLS terverifikasi).");
  process.exit(1);
}

let mysql;
try {
  mysql = (await import("mysql2/promise")).default;
} catch {
  console.error("❌ mysql2 belum terpasang. Jalankan dulu: npm i --no-save mysql2");
  process.exit(1);
}

/** Waktu MySQL → ISO-8601 UTC detik (format kolom waktu D1, lihat 0001_init.sql). */
function isoUtc(d) {
  if (d === null || d === undefined) return null;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) throw new Error(`Tanggal tidak valid: ${d}`);
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
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
/**
 * Literal SQL untuk ekspor. String ditulis sebagai CAST(X'<hex utf8>' AS TEXT):
 * kebal terhadap pemecah statement & heuristik teks wrangler (mis. lokal
 * menghapus "BEGIN TRANSACTION;"/"COMMIT;" di mana pun, termasuk di dalam
 * string). NUL byte dibuang (tokenizer SQLite berhenti di NUL).
 */
function exportValue(v) {
  if (typeof v !== "string") return sqlValue(v);
  let s = v;
  if (s.includes("\u0000")) {
    s = s.replaceAll("\u0000", "");
    nulStripped++;
  }
  return `CAST(X'${Buffer.from(s, "utf8").toString("hex")}' AS TEXT)`;
}
/** Batas panjang satu statement D1 ±100 KB — tolak sebelum impor gagal di tengah. */
const MAX_STATEMENT = 90_000;
function insert(table, cols, values) {
  const id = values[0];
  const stmt = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${values.map(exportValue).join(", ")});`;
  if (Buffer.byteLength(stmt) > MAX_STATEMENT) {
    throw new Error(`${table} #${id} terlalu panjang untuk satu statement D1 — persingkat datanya di cPanel`);
  }
  return stmt;
}

let conn;
try {
  conn = await mysql.createConnection({
    host: dbHost,
    port: Number(process.env.DB_PORT ?? 3306),
    ...(isLocalHost ? {} : { ssl: { rejectUnauthorized: true } }),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    charset: "utf8mb4_general_ci",
    // Baca TIMESTAMP sebagai UTC apa pun zona waktu server cPanel: sesi diset
    // ke +00:00 dan mysql2 menafsirkan nilainya sebagai UTC.
    timezone: "Z",
    dateStrings: false,
  });

  await conn.query("SET time_zone = '+00:00'");
  // Satu snapshot konsisten untuk SEMUA tabel (InnoDB): pesanan/produk yang
  // masuk selama ekspor tidak menghasilkan item yatim atau ekspor setengah.
  // Tetap bekukan situs lama saat ekspor final cutover (Skill 30).
  await conn.query("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await conn.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
  const q = async (sql) => (await conn.query(sql))[0];

  const categories = await q("SELECT id, name, slug, created_at FROM categories ORDER BY id");
  const products = await q(
    `SELECT id, slug, name, category, price, weight_grams, stock_status, is_halal, description,
            ingredients, image, is_featured, created_at, updated_at FROM products ORDER BY id`
  );
  const variants = await q(
    "SELECT id, product_id, name, price_delta, weight_grams, position FROM product_variants ORDER BY id"
  );
  const orders = await q(
    `SELECT id, order_code, recipient_name, phone, fulfillment_method, address, city, location_note,
            status, total_estimate, note, created_at, updated_at FROM orders ORDER BY id`
  );
  const items = await q(
    `SELECT id, order_id, product_id, product_name, variant, quantity, unit_price
       FROM order_items ORDER BY id`
  );
  const admins = await q("SELECT COUNT(*) AS n FROM admin_users");
  await conn.query("COMMIT");

  // Produk berkategori yatim (products.category = slug tanpa FK) tidak tampil
  // di filter katalog dan tidak bisa disimpan ulang di admin → hentikan.
  const catSlugs = new Set(categories.map((c) => String(c.slug).toLowerCase()));
  const orphanCat = products.filter((p) => !catSlugs.has(String(p.category).toLowerCase()));
  if (orphanCat.length > 0) {
    throw new Error(
      `Produk dengan kategori tidak terdaftar: ${orphanCat
        .map((p) => `#${p.id} (${p.category})`)
        .join(", ")} — perbaiki kategorinya di admin cPanel lalu ekspor ulang`
    );
  }

  const lines = [];
  for (const c of categories) {
    lines.push(
      `INSERT INTO categories (name, slug, created_at) VALUES (${[c.name, c.slug, isoUtc(c.created_at)]
        .map(exportValue)
        .join(", ")}) ON CONFLICT (slug) DO UPDATE SET name = excluded.name;`
    );
  }
  for (const p of products) {
    lines.push(
      insert(
        "products",
        ["id", "slug", "name", "category", "price", "weight_grams", "stock_status", "is_halal",
          "description", "ingredients", "image", "is_featured", "created_at", "updated_at"],
        [nonNegInt(p.id, "products.id"), p.slug, p.name, p.category, nonNegInt(p.price, "price"),
          nonNegInt(p.weight_grams, "weight_grams"), oneOf(p.stock_status, STOCK, "stock_status"),
          bool01(p.is_halal), p.description, p.ingredients, p.image, bool01(p.is_featured),
          isoUtc(p.created_at), isoUtc(p.updated_at)]
      )
    );
  }
  for (const v of variants) {
    lines.push(
      insert(
        "product_variants",
        ["id", "product_id", "name", "price_delta", "weight_grams", "position"],
        [nonNegInt(v.id, "variant.id"), nonNegInt(v.product_id, "variant.product_id"), v.name,
          Math.trunc(Number(v.price_delta)), nonNegInt(v.weight_grams, "variant.weight_grams"),
          nonNegInt(v.position, "variant.position")]
      )
    );
  }
  let phonesNormalized = 0;
  for (const o of orders) {
    // Hanya nomor seluler (08…): nomor telepon rumah berkode area 062x yang
    // diketik tanpa 0 ("622…") tidak boleh berubah jadi 022… (kota lain).
    const norm = normalizePhone(String(o.phone ?? ""));
    const phone = isValidPhone(norm) && norm.startsWith("08") ? norm : o.phone;
    if (phone !== o.phone) phonesNormalized++;
    lines.push(
      insert(
        "orders",
        ["id", "order_code", "recipient_name", "phone", "fulfillment_method", "address", "city",
          "location_note", "status", "total_estimate", "note", "created_at", "updated_at"],
        [nonNegInt(o.id, "orders.id"), o.order_code, o.recipient_name, phone,
          oneOf(o.fulfillment_method, METHODS, "fulfillment_method"), o.address, o.city,
          o.location_note, oneOf(o.status, ORDER_STATUSES, "status"),
          o.total_estimate === null ? null : nonNegInt(o.total_estimate, "total_estimate"),
          o.note, isoUtc(o.created_at), isoUtc(o.updated_at)]
      )
    );
  }
  for (const it of items) {
    lines.push(
      insert(
        "order_items",
        ["id", "order_id", "product_id", "product_name", "variant", "quantity", "unit_price"],
        [nonNegInt(it.id, "item.id"), nonNegInt(it.order_id, "item.order_id"),
          it.product_id === null ? null : nonNegInt(it.product_id, "item.product_id"),
          it.product_name, it.variant, nonNegInt(it.quantity, "quantity"),
          nonNegInt(it.unit_price, "unit_price")]
      )
    );
  }

  // Manifest = jumlah baris sumber; dibaca `npm run db:import` untuk verifikasi.
  const manifest = {
    exported_at: new Date().toISOString(),
    categories: categories.length,
    products: products.length,
    product_variants: variants.length,
    orders: orders.length,
    order_items: items.length,
  };
  const header = [
    "-- Ekspor data Rasa Medan MySQL → D1 (scripts/export-mysql.mjs, Skill 25).",
    "-- BERISI DATA PRIBADI PELANGGAN — jangan di-commit/dibagikan; hapus setelah impor.",
    "-- Impor: npm run db:import -- --file <file ini> [--remote]",
    `-- manifest: ${JSON.stringify(manifest)}`,
  ];
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, header.join("\n") + "\n" + lines.join("\n") + "\n", { mode: 0o600 });

  console.log(`✅ Ekspor selesai → ${outFile}`);
  for (const [k, v] of Object.entries(manifest)) if (k !== "exported_at") console.log(`   ${k}: ${v}`);
  console.log(`   nomor HP dinormalisasi ke 08…: ${phonesNormalized}`);
  if (nulStripped > 0) console.log(`   ⚠ nilai berisi NUL byte (dibuang): ${nulStripped}`);
  console.log(
    `ℹ️  admin_users (${admins[0].n}) tidak diekspor — buat ulang: ADMIN_PASSWORD=... npm run seed:admin -- --remote`
  );
} catch (err) {
  console.error("❌ Ekspor gagal:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  await conn?.end().catch(() => {});
}
