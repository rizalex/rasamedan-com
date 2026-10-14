import { cookies } from "next/headers";
import { cache } from "react";
import { dbErrorMessage, query } from "@/lib/db";
import { PBKDF2_ITERATIONS, isSupportedHash, verifyPassword } from "@/lib/password.mjs";

export { hashPassword, needsRehash, verifyPassword } from "@/lib/password.mjs";

/**
 * Auth admin sederhana (bukan untuk pelanggan).
 * - Password di-hash PBKDF2-SHA256 (Web Crypto, lib/password.mjs).
 * - Sesi = cookie HttpOnly berisi token ber-HMAC-SHA256 (crypto.subtle, secret
 *   dari env). Tanpa node:crypto — aman untuk batas CPU Cloudflare Workers (Skill 26).
 */

export const SESSION_COOKIE = "rasa_admin_session";
const MAX_AGE_SEC = 60 * 60 * 8; // 8 jam

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * SHA-256 dari nilai secret yang diketahui publik (pernah ter-commit di repo).
 * Dibandingkan lewat hash agar nilainya sendiri tidak ikut tersimpan di sini.
 */
const KNOWN_PUBLIC_SECRET_HASHES = new Set([
  // Nilai asli yang bocor di .env.example (commit ca47eef).
  "b7d6f91bdf6e7d75189210ee287fb2ca98f8f1f7b8e76360ebdbdb420b6cdb24",
  // Placeholder lama "ganti-dengan-..." (commit 5d23e6a).
  "90929563b58ee0d8ed2189425d32b575dcafdd7ff778e0518d9b49b43e67120e",
]);

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

// Fallback khusus dev: acak per proses, sehingga tidak bisa ditebak/dipalsukan
// (sesi dev hilang saat restart — dapat diterima). Disimpan di globalThis agar
// tidak berganti saat modul dievaluasi ulang oleh HMR `next dev`. Dibuat lazy
// (bukan di global scope modul) karena Cloudflare Workers melarang pembuatan
// nilai acak di luar handler.
const devGlobal = globalThis as typeof globalThis & { __rasaDevSecret?: string };
function devFallbackSecret(): string {
  return (devGlobal.__rasaDevSecret ??= toHex(crypto.getRandomValues(new Uint8Array(32))));
}
let devWarned = false;

async function secret(): Promise<string> {
  const s = process.env.ADMIN_SESSION_SECRET ?? "";
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(s)));
  const isPublic = KNOWN_PUBLIC_SECRET_HASHES.has(toHex(digest));
  if (s.length >= 32 && !isPublic) return s;
  // Tanpa secret yang kuat, JANGAN pakai nilai fallback (Skill 21.2 no. 2):
  // di production login harus ditolak, bukan ditandatangani secret publik.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ADMIN_SESSION_SECRET wajib diisi minimal 32 karakter acak milik sendiri di production."
    );
  }
  if (!devWarned) {
    devWarned = true;
    console.warn(
      "[auth] ADMIN_SESSION_SECRET kosong/terlalu pendek/sudah bocor — memakai secret acak sementara (dev saja)."
    );
  }
  return devFallbackSecret();
}

/**
 * Lempar error bila konfigurasi auth tidak layak. Panggil di awal handler login,
 * SEBELUM verifikasi password, agar respons tidak bisa dipakai sebagai oracle.
 */
export async function assertAuthConfigured(): Promise<void> {
  await secret();
}

/**
 * Hash format valid untuk username yang tidak ada: login tetap menjalankan
 * PBKDF2 dengan biaya sama, sehingga waktu respons tidak membedakan username
 * terdaftar dari yang tidak (cegah enumerasi lewat timing).
 */
const DUMMY_HASH = `pbkdf2:${PBKDF2_ITERATIONS}:${"0".repeat(32)}:${"0".repeat(64)}`;

/** Verifikasi kredensial; `stored` null = username tidak ada (tetap di-hash). */
export async function verifyLogin(password: string, stored: string | null): Promise<boolean> {
  // Hash tak dikenali (mis. scrypt era cPanel) juga di-hash dummy: tanpa ini
  // respons yang lebih cepat membocorkan bahwa username tersebut ada.
  const usable = stored !== null && isSupportedHash(stored);
  const ok = await verifyPassword(password, usable ? stored : DUMMY_HASH);
  return usable && ok;
}

// ---- Signed session token (HMAC-SHA256 via crypto.subtle) ----
// CryptoKey di-cache per nilai secret (dibuat lazy di dalam request, bukan di
// global scope modul); secret berganti → kunci baru.
let hmacCache: { secret: string; key: Promise<CryptoKey> } | null = null;

async function hmacKey(): Promise<CryptoKey> {
  const s = await secret();
  if (!hmacCache || hmacCache.secret !== s) {
    hmacCache = {
      secret: s,
      key: crypto.subtle.importKey(
        "raw",
        encoder.encode(s),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
      ),
    };
  }
  const cached = hmacCache;
  try {
    return await cached.key;
  } catch (err) {
    // Jangan simpan Promise yang gagal: request berikutnya mencoba lagi.
    if (hmacCache === cached) hmacCache = null;
    throw err;
  }
}

/**
 * Token sesi memuat `ver` = admin_users.session_version saat login (Skill 21.2
 * no. 5). Versi dinaikkan saat password diganti → semua token lama (di perangkat
 * mana pun) otomatis tidak berlaku. Bukan pengganti rotasi secret: pemegang
 * secret bocor tetap bisa menebak `ver` (angka kecil).
 */
export async function createSessionToken(adminId: number, version: number): Promise<string> {
  const payload = base64UrlEncode(
    encoder.encode(
      JSON.stringify({ sub: adminId, ver: version, exp: Date.now() + MAX_AGE_SEC * 1000 })
    )
  );
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(payload));
  return `${payload}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export async function verifySessionToken(
  token: string | undefined
): Promise<{ sub: number; ver: number } | null> {
  if (!token || token.length > 1024) return null;
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined) return null;
  const sigBytes = base64UrlDecode(sig);
  if (!sigBytes) return null;
  // crypto.subtle.verify membandingkan tanda tangan secara waktu-konstan.
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(),
    sigBytes,
    encoder.encode(payload)
  );
  if (!valid) return null;
  try {
    const bytes = base64UrlDecode(payload);
    if (!bytes) return null;
    const data = JSON.parse(decoder.decode(bytes));
    if (!data.exp || Date.now() > data.exp) return null;
    // Token lama tanpa versi ditolak (admin cukup login ulang sekali).
    if (!Number.isInteger(data.ver) || !Number.isInteger(data.sub)) return null;
    return { sub: data.sub, ver: data.ver };
  } catch {
    return null;
  }
}

// ---- Cookie helpers (Next 15: cookies() is async) ----
/**
 * Sesi admin aktif, atau null. Selain tanda tangan & kedaluwarsa, versi sesi
 * dicocokkan dengan DB: password diganti / akun dihapus → sesi tidak berlaku.
 * Satu query per render (dibungkus `cache`, jadi layout + page cukup sekali).
 * Secret tidak valid / DB error → null (fail-closed).
 */
export const getAdminSession = cache(async (): Promise<{ sub: number } | null> => {
  const store = await cookies();
  try {
    const token = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
    if (!token) return null;
    const rows = await query<{ session_version: number }>(
      "SELECT session_version FROM admin_users WHERE id = ? LIMIT 1",
      [token.sub]
    );
    if (rows.length === 0 || Number(rows[0].session_version) !== token.ver) return null;
    return { sub: token.sub };
  } catch (err) {
    console.error("[auth] Gagal memeriksa sesi:", dbErrorMessage(err));
    return null;
  }
});

export async function setAdminCookie(adminId: number, version: number): Promise<void> {
  const token = await createSessionToken(adminId, version);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE_SEC,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
