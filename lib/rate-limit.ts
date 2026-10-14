import { batch, dbErrorMessage, execute, query, statement } from "@/lib/db";

/**
 * Rate limiting di tabel D1 `login_failures` (Skill 28; sebelumnya in-memory
 * per isolate — tidak andal di Cloudflare Workers karena isolate berganti).
 * Tahan restart/deploy dan berlaku sama di semua isolate.
 *
 * Satu baris = satu percobaan tercatat untuk `bucket` (kunci rate limit, mis.
 * "login:<ip>", "checkorder:<ip>", "order:<ip>", "ordercaptcha:<ip>",
 * "account:<adminId>"), `ts` = epoch milidetik.
 * Default: maks 5 percobaan dalam 15 menit per kunci; setelah itu terkunci
 * sampai catatan tertua keluar dari jendela waktu.
 *
 * Gagal tertutup: bila D1 error, `checkRateLimit`/`consumeRateLimit`
 * melaporkan "terkunci" (operasi yang dilindungi juga butuh D1, jadi tidak
 * ada yang hilang). `refund`/`reset` yang gagal hanya dicatat di log.
 */

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 menit
const DEFAULT_MAX_FAILURES = 5;
const MAX_KEY_LENGTH = 100;
/** Jeda saat D1 tidak tersedia (fail-closed). */
const UNAVAILABLE_RETRY_SEC = 60;
/** Catatan lebih tua dari ini dihapus sesekali (lebih panjang dari jendela terpanjang: 1 jam). */
const SWEEP_AGE_MS = 24 * 60 * 60 * 1000;
const SWEEP_PROBABILITY = 0.02;
/** Maks baris basi yang dihapus per sweep (konstanta internal, bukan input). */
const SWEEP_BATCH = 500;

export type RateLimitStatus = { limited: boolean; retryAfterSec: number };

function normalizeKey(key: string): string {
  return key.slice(0, MAX_KEY_LENGTH);
}

function retryAfter(oldestTs: number, now: number, windowMs: number): number {
  return Math.max(1, Math.ceil((windowMs - (now - oldestTs)) / 1000));
}

/** Jumlah percobaan & catatan tertua dalam jendela untuk satu kunci. */
async function windowStats(
  bucket: string,
  since: number
): Promise<{ n: number; oldest: number | null }> {
  const rows = await query<{ n: number; oldest: number | null }>(
    "SELECT COUNT(*) AS n, MIN(ts) AS oldest FROM login_failures WHERE bucket = ? AND ts > ?",
    [bucket, since]
  );
  return { n: Number(rows[0]?.n ?? 0), oldest: rows[0]?.oldest ?? null };
}

/** Cek apakah kunci sedang terkunci. Tidak menambah hitungan. */
export async function checkRateLimit(
  key: string,
  max: number = DEFAULT_MAX_FAILURES,
  windowMs: number = DEFAULT_WINDOW_MS
): Promise<RateLimitStatus> {
  const now = Date.now();
  try {
    const { n, oldest } = await windowStats(normalizeKey(key), now - windowMs);
    if (n >= max && oldest !== null) {
      return { limited: true, retryAfterSec: retryAfter(oldest, now, windowMs) };
    }
    return { limited: false, retryAfterSec: 0 };
  } catch (err) {
    console.error("[rate-limit] check gagal:", dbErrorMessage(err));
    return { limited: true, retryAfterSec: UNAVAILABLE_RETRY_SEC };
  }
}

/**
 * Cek + catat secara atomik: INSERT bersyarat dalam SATU statement, sehingga
 * request paralel tidak bisa lolos bersamaan melewati batas (D1 menjalankan
 * statement tulis satu per satu). Bila tidak terkunci, satu jatah langsung
 * dipakai; kembalikan dengan `refundRateLimit(key, stamp)` bila operasi
 * akhirnya gagal karena sebab di luar kendali klien.
 * `stamp` = penanda catatan "<rowid>:<ts>" ("" bila terkunci / tidak tercatat).
 * ts ikut dicocokkan karena rowid bisa dipakai ulang setelah baris terhapus
 * (tabel tanpa AUTOINCREMENT) — refund tidak boleh menghapus catatan lain.
 */
export async function consumeRateLimit(
  key: string,
  max: number = DEFAULT_MAX_FAILURES,
  windowMs: number = DEFAULT_WINDOW_MS
): Promise<RateLimitStatus & { stamp: string }> {
  const bucket = normalizeKey(key);
  const now = Date.now();
  const since = now - windowMs;
  try {
    const [, inserted] = await batch([
      // Rapikan catatan kunci ini yang sudah keluar dari jendela.
      statement("DELETE FROM login_failures WHERE bucket = ? AND ts <= ?", [bucket, since]),
      statement(
        `INSERT INTO login_failures (bucket, ts)
         SELECT ?, ?
          WHERE (SELECT COUNT(*) FROM login_failures WHERE bucket = ? AND ts > ?) < ?`,
        [bucket, now, bucket, since, max]
      ),
    ]);
    // Sesekali hapus catatan basi kunci lain (IP yang tidak kembali lagi).
    // Di-await (bukan fire-and-forget): Workers bisa memutus promise yang
    // belum selesai setelah respons terkirim.
    if (Math.random() < SWEEP_PROBABILITY) {
      try {
        // Dibatasi per eksekusi + index (ts) dari 0002: biaya baca/tulis D1
        // tetap kecil walau tabel diisi banyak IP penyerang.
        await execute(
          `DELETE FROM login_failures WHERE rowid IN
             (SELECT rowid FROM login_failures WHERE ts < ? LIMIT ${SWEEP_BATCH})`,
          [now - SWEEP_AGE_MS]
        );
      } catch (err) {
        console.error("[rate-limit] sweep gagal:", dbErrorMessage(err));
      }
    }
    if (inserted.meta.changes === 1) {
      return { limited: false, retryAfterSec: 0, stamp: `${inserted.meta.last_row_id}:${now}` };
    }
    const { oldest } = await windowStats(bucket, since);
    return {
      limited: true,
      retryAfterSec: oldest !== null ? retryAfter(oldest, now, windowMs) : 1,
      stamp: "",
    };
  } catch (err) {
    console.error("[rate-limit] consume gagal:", dbErrorMessage(err));
    return { limited: true, retryAfterSec: UNAVAILABLE_RETRY_SEC, stamp: "" };
  }
}

/** Kembalikan satu jatah yang diambil `consumeRateLimit` (pakai `stamp`-nya). */
export async function refundRateLimit(key: string, stamp: string): Promise<void> {
  const [rowid, ts] = stamp.split(":").map(Number);
  if (!Number.isInteger(rowid) || !Number.isInteger(ts) || rowid < 1) return;
  try {
    await execute("DELETE FROM login_failures WHERE rowid = ? AND bucket = ? AND ts = ?", [
      rowid,
      normalizeKey(key),
      ts,
    ]);
  } catch (err) {
    console.error("[rate-limit] refund gagal:", dbErrorMessage(err));
  }
}

/** Reset hitungan (dipanggil setelah login sukses). */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await execute("DELETE FROM login_failures WHERE bucket = ?", [normalizeKey(key)]);
  } catch (err) {
    console.error("[rate-limit] reset gagal:", dbErrorMessage(err));
  }
}
