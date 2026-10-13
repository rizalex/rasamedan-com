import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";

/**
 * Auth admin sederhana (bukan untuk pelanggan).
 * - Password di-hash dengan scrypt (node:crypto bawaan, tanpa binary native).
 * - Sesi = cookie HttpOnly berisi token ber-HMAC-SHA256 (secret dari env).
 */

export const SESSION_COOKIE = "rasa_admin_session";
const MAX_AGE_SEC = 60 * 60 * 8; // 8 jam

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

// Fallback khusus dev: acak per proses, sehingga tidak bisa ditebak/dipalsukan
// (sesi dev hilang saat restart — dapat diterima). Disimpan di globalThis agar
// tidak berganti saat modul dievaluasi ulang oleh HMR `next dev`.
const devGlobal = globalThis as typeof globalThis & { __rasaDevSecret?: string };
const DEV_FALLBACK_SECRET = (devGlobal.__rasaDevSecret ??= randomBytes(32).toString("hex"));
let devWarned = false;

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET ?? "";
  const isPublic = KNOWN_PUBLIC_SECRET_HASHES.has(
    createHash("sha256").update(s).digest("hex")
  );
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
  return DEV_FALLBACK_SECRET;
}

/**
 * Lempar error bila konfigurasi auth tidak layak. Panggil di awal handler login,
 * SEBELUM verifikasi password, agar respons tidak bisa dipakai sebagai oracle.
 */
export function assertAuthConfigured(): void {
  secret();
}

// ---- Password hashing (format: saltHex:hashHex) ----
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const computed = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    computed.length === expected.length &&
    timingSafeEqual(computed, expected)
  );
}

// ---- Signed session token ----
function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createSessionToken(adminId: number): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: adminId, exp: Date.now() + MAX_AGE_SEC * 1000 })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(
  token: string | undefined
): { sub: number } | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data.exp || Date.now() > data.exp) return null;
    return { sub: Number(data.sub) };
  } catch {
    return null;
  }
}

// ---- Cookie helpers (Next 15: cookies() is async) ----
export async function getAdminSession(): Promise<{ sub: number } | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function setAdminCookie(adminId: number): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(adminId), {
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
