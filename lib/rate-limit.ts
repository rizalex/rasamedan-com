/**
 * Rate limiting login sederhana & in-memory (Skill 15).
 *
 * Cukup untuk MVP di cPanel/Passenger yang umumnya menjalankan 1 proses Node.
 * Membatasi percobaan login gagal: maks 5 kegagalan dalam 15 menit per-kunci
 * (biasanya alamat IP). Setelah itu dikunci sementara sampai jendela waktu lewat.
 *
 * Catatan: state hilang saat proses restart (dapat diterima untuk MVP). Untuk
 * skala besar/multi-proses, pindahkan ke store bersama (mis. Redis/tabel DB).
 */

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 menit
const DEFAULT_MAX_FAILURES = 5;

// key -> daftar timestamp (ms) kegagalan dalam jendela waktu.
const store = new Map<string, number[]>();

function recent(list: number[], now: number, windowMs: number): number[] {
  return list.filter((t) => now - t < windowMs);
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
  const now = Date.now();
  const list = recent(store.get(key) ?? [], now, windowMs);
  store.set(key, list);
  if (list.length >= max) {
    const oldest = list[0];
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    return { limited: true, retryAfterSec };
  }
  return { limited: false, retryAfterSec: 0 };
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
  const now = Date.now();
  const list = recent(store.get(key) ?? [], now, windowMs);
  list.push(now);
  store.set(key, list);
}

/** Reset hitungan (dipanggil setelah login sukses). */
export function resetRateLimit(key: string): void {
  store.delete(key);
}
