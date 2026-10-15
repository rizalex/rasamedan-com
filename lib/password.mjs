/**
 * Hashing password admin dengan PBKDF2-SHA256 via Web Crypto (Skill 26).
 * Berjalan sama di Cloudflare Workers, `next dev`, dan skrip Node
 * (scripts/seed-admin.mjs) — karena itu ditulis sebagai .mjs tanpa dependensi.
 *
 * Format tersimpan: `pbkdf2:<iterasi>:<saltHex>:<hashHex>` (salt 16 byte,
 * hash 32 byte). Iterasi ikut disimpan sehingga bisa dinaikkan kelak tanpa
 * memutus password lama (lihat `needsRehash`).
 *
 * Iterasi 30.000 (bukan 100.000): batas CPU Workers Free 10 ms/request.
 * Terukur ±5 ms untuk 30.000 vs ±16 ms untuk 100.000 (Node/BoringSSL setara
 * workerd). Kompensasinya: login dibatasi rate limit + Turnstile, dan password
 * admin minimal 12 karakter. Bila pindah ke paket berbayar, naikkan
 * PBKDF2_ITERATIONS (maks 100.000 — batas PBKDF2 di Workers); hash lama
 * di-upgrade otomatis saat admin login berikutnya.
 */

export const PBKDF2_ITERATIONS = 30_000;
const MAX_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

const encoder = new TextEncoder();

/** @param {Uint8Array} bytes */
function toHex(bytes) {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/** @param {string} hex @returns {Uint8Array | null} */
function fromHex(hex) {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/**
 * @param {string} password
 * @param {Uint8Array} salt
 * @param {number} iterations
 * @returns {Promise<Uint8Array>}
 */
async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    HASH_BYTES * 8
  );
  return new Uint8Array(bits);
}

/** Perbandingan waktu-konstan (XOR) untuk dua array sama panjang. */
function constantTimeEqual(/** @type {Uint8Array} */ a, /** @type {Uint8Array} */ b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * @param {string} stored
 * @returns {{ iterations: number, salt: Uint8Array, hash: Uint8Array } | null}
 */
function parse(stored) {
  const parts = String(stored ?? "").split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return null;
  if (!/^\d{1,6}$/.test(parts[1])) return null;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) return null;
  const salt = fromHex(parts[2]);
  const hash = fromHex(parts[3]);
  if (!salt || salt.length !== SALT_BYTES || !hash || hash.length !== HASH_BYTES) return null;
  return { iterations, salt, hash };
}

/** @param {string} password @returns {Promise<string>} */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${toHex(salt)}:${toHex(hash)}`;
}

/**
 * Cocokkan password dengan hash tersimpan. Format lain (mis. scrypt `salt:hash`
 * dari era cPanel) selalu ditolak — admin direset lewat `seed:admin --reset`.
 * @param {string} password
 * @param {string} stored
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, stored) {
  const parsed = parse(stored);
  if (!parsed) return false;
  const computed = await derive(password, parsed.salt, parsed.iterations);
  return constantTimeEqual(computed, parsed.hash);
}

/** Hash valid tapi iterasinya lebih rendah dari setelan sekarang → perlu di-upgrade. */
export function needsRehash(/** @type {string} */ stored) {
  const parsed = parse(stored);
  return parsed !== null && parsed.iterations < PBKDF2_ITERATIONS;
}

/** Format hash dikenali (dipakai untuk pesan log saat hash lama/rusak). */
export function isSupportedHash(/** @type {string} */ stored) {
  return parse(stored) !== null;
}
