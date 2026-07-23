import {
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

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? "dev-insecure-secret-change-me";
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
