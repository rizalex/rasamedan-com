import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Akses database Cloudflare D1 (SQLite) lewat binding `DB` (Skill 24).
 *
 * - Production / `npm run preview`: binding dari Worker (wrangler.jsonc).
 * - `next dev`: binding D1 lokal disiapkan `initOpenNextCloudflareForDev()` di
 *   next.config.mjs (data di `.wrangler/state`, isi dengan `npm run db:migrate`).
 *
 * Binding diambil per pemanggilan (bukan di global scope modul) — aturan Workers.
 *
 * SELALU gunakan parameterized query (tanda `?`) untuk mencegah SQL injection.
 * Contoh:  const rows = await query<Row>("SELECT * FROM products WHERE id = ?", [id]);
 * Untuk `IN (...)`, buat satu `?` per elemen (lihat `placeholders()`).
 */

/** Nilai yang boleh di-bind ke query. Boolean simpan sebagai 0/1. */
export type SqlValue = string | number | null;

function db(): D1Database {
  const database = getCloudflareContext().env.DB;
  if (!database) {
    throw new Error("Binding D1 `DB` tidak tersedia (cek d1_databases di wrangler.jsonc)");
  }
  return database;
}

/** Siapkan statement ber-parameter, untuk dipakai di `batch()`. */
export function statement(sql: string, params: SqlValue[] = []): D1PreparedStatement {
  const stmt = db().prepare(sql);
  return params.length > 0 ? stmt.bind(...params) : stmt;
}

/** Jalankan SELECT dan kembalikan semua baris. */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: SqlValue[] = []
): Promise<T[]> {
  const res = await statement(sql, params).all<T>();
  return res.results;
}

/** Jalankan INSERT/UPDATE/DELETE. `changes` = baris yang berubah. */
export async function execute(
  sql: string,
  params: SqlValue[] = []
): Promise<{ changes: number; lastRowId: number }> {
  const res = await statement(sql, params).run();
  return { changes: res.meta.changes, lastRowId: res.meta.last_row_id };
}

/**
 * Jalankan beberapa statement secara atomik (satu transaksi implisit D1):
 * satu gagal → semuanya dibatalkan. Pengganti beginTransaction/commit MySQL.
 * D1 tidak mendukung BEGIN/COMMIT eksplisit.
 */
export async function batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
  if (statements.length === 0) return [];
  return db().batch(statements);
}

/** `?, ?, ?` sebanyak `n` — untuk klausa `IN (...)`. */
export function placeholders(n: number): string {
  return Array.from({ length: n }, () => "?").join(", ");
}

/** D1 menolak query dengan lebih dari 100 parameter terikat. */
const IN_CHUNK = 90;

/**
 * SELECT dengan `IN (...)` atas daftar id yang bisa panjang: dipecah per
 * IN_CHUNK id agar tidak melewati batas parameter D1, hasilnya digabung.
 * `buildSql` menerima string placeholder untuk satu potongan.
 */
export async function queryIn<T = Record<string, unknown>>(
  buildSql: (inPlaceholders: string) => string,
  ids: SqlValue[]
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const part = ids.slice(i, i + IN_CHUNK);
    out.push(...(await query<T>(buildSql(placeholders(part.length)), part)));
  }
  return out;
}

/** Pelanggaran UNIQUE (mis. order_code/slug kembar karena request bersamaan). */
export function isUniqueViolation(err: unknown): boolean {
  return /UNIQUE constraint failed/i.test(String((err as { message?: string })?.message ?? err));
}

/**
 * Pesan error DB yang aman untuk log: hanya pesan singkat, tanpa objek error
 * utuh (yang bisa memuat nilai parameter seperti nomor HP atau hash password).
 */
export function dbErrorMessage(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? "unknown");
  // D1_TYPE_ERROR menyebut nilai parameter ("... value '<nilai>' ...") — buang.
  return msg.replace(/value\s+'[\s\S]*$/i, "value <disembunyikan>").slice(0, 200);
}
