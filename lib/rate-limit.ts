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

const WINDOW_MS = 15 * 60 * 1000; // 15 menit
const MAX_FAILURES = 5;

// key -> daftar timestamp (ms) kegagalan dalam jendela waktu.
const store = new Map<string, number[]>();

function recent(list: number[], now: number): number[] {
  return list.filter((t) => now - t < WINDOW_MS);
}

/** Cek apakah kunci sedang terkunci. Tidak menambah hitungan. */
export function checkRateLimit(key: string): {
  limited: boolean;
  retryAfterSec: number;
} {
  const now = Date.now();
  const list = recent(store.get(key) ?? [], now);
  store.set(key, list);
  if (list.length >= MAX_FAILURES) {
    const oldest = list[0];
    const retryAfterSec = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));
    return { limited: true, retryAfterSec };
  }
  return { limited: false, retryAfterSec: 0 };
}

/** Catat satu kegagalan login untuk kunci ini. */
export function recordFailure(key: string): void {
  const now = Date.now();
  const list = recent(store.get(key) ?? [], now);
  list.push(now);
  store.set(key, list);
}

/** Reset hitungan (dipanggil setelah login sukses). */
export function resetRateLimit(key: string): void {
  store.delete(key);
}
