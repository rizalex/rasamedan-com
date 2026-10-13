/**
 * Rate limiting sederhana & in-memory (Skill 15, 21.2 no. 3).
 *
 * State in-memory per proses/isolate — di Cloudflare Workers tidak andal
 * (isolate bisa berganti); dipindah ke tabel D1 di Skill 28.
 * Default: maks 5 kegagalan dalam 15 menit per-kunci (biasanya alamat IP).
 * Setelah itu dikunci sementara sampai jendela waktu lewat.
 *
 * Catatan: state hilang saat proses restart (dapat diterima untuk MVP). Untuk
 * skala besar/multi-proses, pindahkan ke store bersama (mis. tabel DB).
 */

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 menit
const DEFAULT_MAX_FAILURES = 5;

// Batas memori: kunci berasal dari header yang bisa diisi klien, jadi panjang
// kunci dan jumlah entri dibatasi agar store tidak tumbuh tanpa batas.
const MAX_KEY_LENGTH = 100;
const MAX_KEYS = 10_000;

// key -> daftar timestamp (ms) dalam jendela waktu. Urutan Map = urutan
// terakhir diperbarui, sehingga entri pertama adalah yang paling lama diam.
const store = new Map<string, number[]>();

function normalizeKey(key: string): string {
  return key.slice(0, MAX_KEY_LENGTH);
}

function recent(list: number[], now: number, windowMs: number): number[] {
  return list.filter((t) => now - t < windowMs);
}

/** Simpan list untuk kunci; list kosong dihapus, entri tertua dibuang bila penuh. */
function save(key: string, list: number[]): void {
  store.delete(key);
  if (list.length === 0) return;
  while (store.size >= MAX_KEYS) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
  store.set(key, list);
}

function status(
  list: number[],
  now: number,
  max: number,
  windowMs: number
): { limited: boolean; retryAfterSec: number } {
  if (list.length >= max) {
    const oldest = list[0];
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    return { limited: true, retryAfterSec };
  }
  return { limited: false, retryAfterSec: 0 };
}

/** Cek apakah kunci sedang terkunci. Tidak menambah hitungan. */
export function checkRateLimit(
  key: string,
  max: number = DEFAULT_MAX_FAILURES,
  windowMs: number = DEFAULT_WINDOW_MS
): {
  limited: boolean;
  retryAfterSec: number;
} {
  const k = normalizeKey(key);
  const now = Date.now();
  const list = recent(store.get(k) ?? [], now, windowMs);
  if (list.length === 0) store.delete(k);
  return status(list, now, max, windowMs);
}

/**
 * Catat satu kegagalan/percobaan untuk kunci ini. `windowMs` harus sama dengan
 * yang dipakai di `checkRateLimit` untuk kunci yang sama, agar catatan lama
 * tidak terbuang lebih cepat dari jendelanya.
 */
export function recordFailure(
  key: string,
  windowMs: number = DEFAULT_WINDOW_MS
): void {
  const k = normalizeKey(key);
  const now = Date.now();
  const list = recent(store.get(k) ?? [], now, windowMs);
  list.push(now);
  save(k, list);
}

/**
 * Cek + catat dalam satu langkah sinkron (tanpa `await` di antaranya), sehingga
 * request paralel tidak bisa lolos bersamaan sebelum ada yang tercatat.
 * Bila tidak terkunci, satu jatah langsung dipakai; kembalikan dengan `refund`
 * bila operasi akhirnya gagal.
 */
export function consumeRateLimit(
  key: string,
  max: number = DEFAULT_MAX_FAILURES,
  windowMs: number = DEFAULT_WINDOW_MS
): { limited: boolean; retryAfterSec: number; stamp: number } {
  const k = normalizeKey(key);
  const now = Date.now();
  const list = recent(store.get(k) ?? [], now, windowMs);
  const st = status(list, now, max, windowMs);
  if (st.limited) {
    save(k, list);
    return { ...st, stamp: 0 };
  }
  list.push(now);
  save(k, list);
  return { ...st, stamp: now };
}

/** Kembalikan satu jatah yang diambil `consumeRateLimit` (pakai `stamp`-nya). */
export function refundRateLimit(key: string, stamp: number): void {
  const k = normalizeKey(key);
  const list = store.get(k);
  if (!list) return;
  const idx = list.lastIndexOf(stamp);
  if (idx === -1) return;
  list.splice(idx, 1);
  save(k, list);
}

/** Reset hitungan (dipanggil setelah login sukses). */
export function resetRateLimit(key: string): void {
  store.delete(normalizeKey(key));
}
