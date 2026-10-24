/**
 * Klien HTTP api.co.id Kurir API (Skill 31). SERVER-ONLY: membaca secret
 * `API_CO_ID_KEY` — jangan diimpor komponen klien (dipakai lewat lib/shipping.ts
 * oleh route /api/shipping/* dan /api/orders).
 *
 * Hasil uji gerbang 31.0 (SKILLS.md 31b): parameter `weight` dalam KILOGRAM
 * (min 0.1, maks 1000), kode kecamatan 6 digit, amplop `{ is_success, message, data }`.
 * Log hanya status + potongan `message` (tanpa key, body, atau IP).
 */

const BASE_URL = "https://use.api.co.id/courier";
const TIMEOUT_MS = 6000;

export type ApiCoIdErrorKind = "disabled" | "auth" | "balance" | "quota" | "invalid" | "upstream" | "timeout";
export type ApiCoIdResult<T> = { ok: true; data: T } | { ok: false; kind: ApiCoIdErrorKind; status: number };

/** Key terpasang? (dibaca per pemanggilan, bukan di global scope modul). */
export function hasApiCoIdKey(): boolean {
  return Boolean(process.env.API_CO_ID_KEY);
}

function errorKind(status: number): ApiCoIdErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 402) return "balance";
  if (status === 429) return "quota";
  if (status === 400 || status === 404 || status === 422) return "invalid";
  return "upstream";
}

/** GET ke api.co.id; `params` dibangun dengan URLSearchParams (tanpa nilai mentah di path). */
export async function apiCoIdGet<T>(path: string, params: Record<string, string>): Promise<ApiCoIdResult<T>> {
  const key = process.env.API_CO_ID_KEY ?? "";
  if (!key) return { ok: false, kind: "disabled", status: 0 };
  const qs = new URLSearchParams(params).toString();
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}${qs ? `?${qs}` : ""}`, {
      headers: { "x-api-co-id": key, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "error";
    console.error(`[api.co.id] ${path} gagal: ${name}`);
    return { ok: false, kind: name === "TimeoutError" || name === "AbortError" ? "timeout" : "upstream", status: 0 };
  }
  let body: { is_success?: boolean; message?: string; data?: T } | null = null;
  try {
    body = await res.json();
  } catch {
    /* bukan JSON */
  }
  if (!res.ok || body?.is_success !== true) {
    const kind = res.ok ? "invalid" : errorKind(res.status);
    const msg = String(body?.message ?? "").slice(0, 120);
    // 422 "tidak dilayani kurir" wajar (rute tidak dilayani) → warn, sisanya error.
    (kind === "invalid" ? console.warn : console.error)(`[api.co.id] ${path} HTTP ${res.status}: ${msg}`);
    return { ok: false, kind, status: res.status };
  }
  return { ok: true, data: body.data as T };
}
