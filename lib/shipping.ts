import { dbErrorMessage, execute, placeholders, query } from "@/lib/db";
import { apiCoIdGet, hasApiCoIdKey, type ApiCoIdErrorKind } from "@/lib/api-co-id";
import type { ShippingRate, ShippingSnapshot } from "@/lib/orders";
import { getDisabledCourierCodes, isApiCourierAllowed } from "@/lib/courier-settings";

/**
 * Estimasi ongkir (Skill 31) — SERVER-ONLY. Konfigurasi, cache D1
 * (`shipping_cache`), circuit breaker, normalizer api.co.id, dan pencocokan
 * pilihan pelanggan saat membuat pesanan.
 *
 * Keputusan pemilik (SKILLS.md 31a/31b): asal = SHIPPING_ORIGIN_DISTRICT_CODE,
 * paket diantar ke agen (`sender_type=dropped`), semua kurir tetapi hanya layanan
 * Standard & Nextday (tanpa Cargo), harga = `normal_price` (tarif loket) dibulatkan
 * ke atas ke Rp 1.000, berat = Σ berat item (tanpa kemasan) dikirim dalam kg.
 * Normalizer ditulis dari respons asli (docs/api-co-id-*-sample.json): field
 * yang hilang/aneh → baris dibuang, bukan ditebak.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const LOCATION_TTL_MS = 30 * DAY_MS;
const RATE_TTL_MS = 12 * 60 * 60 * 1000;
const EMPTY_RATE_TTL_MS = 60 * 60 * 1000;
/** Tarif di cache masih diterima saat membuat pesanan sampai umur ini. */
export const RATE_ORDER_GRACE_MS = 14 * 60 * 60 * 1000;
const CIRCUIT_MS = 60 * 60 * 1000;
const SWEEP_PROBABILITY = 0.02;

export const MAX_WEIGHT_GRAMS = 30_000;
const WEIGHT_STEP_GRAMS = 100;
const PRICE_STEP = 1000;
const MAX_RATES = 20;
const ALLOWED_SERVICE_TYPES = new Set(["standard", "nextday"]);

export type LocationLevel = "province" | "city" | "district";
export type Location = { code: string; name: string };

const CODE_RE: Record<LocationLevel, RegExp> = {
  province: /^\d{2}$/,
  city: /^\d{4}$/,
  district: /^\d{6}$/,
};

export function isLocationCode(level: LocationLevel, code: unknown): code is string {
  return typeof code === "string" && CODE_RE[level].test(code);
}

/** Fitur aktif bila key api.co.id dan kecamatan asal terpasang. */
export function getShippingConfig(): { enabled: boolean; origin: string; dailyCap: number } {
  const origin = process.env.SHIPPING_ORIGIN_DISTRICT_CODE ?? "";
  const cap = Number(process.env.SHIPPING_RATES_DAILY_CAP ?? "");
  return {
    enabled: hasApiCoIdKey() && isLocationCode("district", origin),
    origin,
    dailyCap: Number.isInteger(cap) && cap > 0 ? cap : 100,
  };
}

// ---------------------------------------------------------------- cache D1

type CacheRow = { cache_key: string; payload: string; fetched_at: string; expires_at: string };
type CacheEntry<T> = { value: T; fetchedAt: string; fresh: boolean };

function parseEntry<T>(row: CacheRow, now: string): CacheEntry<T> | null {
  try {
    return { value: JSON.parse(row.payload) as T, fetchedAt: row.fetched_at, fresh: row.expires_at > now };
  } catch {
    return null;
  }
}

async function cacheGetMany<T>(keys: string[]): Promise<Map<string, CacheEntry<T>>> {
  const out = new Map<string, CacheEntry<T>>();
  if (keys.length === 0) return out;
  const rows = await query<CacheRow>(
    `SELECT cache_key, payload, fetched_at, expires_at FROM shipping_cache WHERE cache_key IN (${placeholders(keys.length)})`,
    keys
  );
  const now = new Date().toISOString();
  for (const row of rows) {
    const entry = parseEntry<T>(row, now);
    if (entry) out.set(row.cache_key, entry);
  }
  return out;
}

async function cacheGet<T>(key: string): Promise<CacheEntry<T> | null> {
  return (await cacheGetMany<T>([key])).get(key) ?? null;
}

async function cachePut(key: string, value: unknown, ttlMs: number): Promise<string> {
  const now = Date.now();
  const fetchedAt = new Date(now).toISOString();
  await execute(
    "INSERT OR REPLACE INTO shipping_cache (cache_key, payload, fetched_at, expires_at) VALUES (?, ?, ?, ?)",
    [key, JSON.stringify(value), fetchedAt, new Date(now + ttlMs).toISOString()]
  );
  // Sesekali buang baris yang sudah kedaluwarsa > 24 jam (dibatasi per eksekusi).
  if (Math.random() < SWEEP_PROBABILITY) {
    try {
      await execute(
        `DELETE FROM shipping_cache WHERE cache_key IN
           (SELECT cache_key FROM shipping_cache WHERE expires_at < ? LIMIT 200)`,
        [new Date(now - DAY_MS).toISOString()]
      );
    } catch (err) {
      console.error("[shipping] sweep gagal:", dbErrorMessage(err));
    }
  }
  return fetchedAt;
}

// ------------------------------------------------------------ circuit breaker

const CIRCUIT_KEY = "circuit:rates";

export async function isCircuitOpen(): Promise<boolean> {
  const entry = await cacheGet<string>(CIRCUIT_KEY);
  return Boolean(entry?.fresh);
}

/** Key ditolak / saldo habis / kuota plan habis → jangan panggil upstream selama 60 menit. */
async function maybeOpenCircuit(kind: ApiCoIdErrorKind): Promise<void> {
  if (kind !== "auth" && kind !== "balance" && kind !== "quota") return;
  console.error(`[shipping] circuit dibuka 60 menit (${kind}) — cek key/saldo api.co.id.`);
  try {
    await cachePut(CIRCUIT_KEY, kind, CIRCUIT_MS);
  } catch (err) {
    console.error("[shipping] gagal membuka circuit:", dbErrorMessage(err));
  }
}

// ----------------------------------------------------------------- lokasi

function normalizeLocations(level: LocationLevel, data: unknown): Location[] {
  if (!Array.isArray(data)) return [];
  const out: Location[] = [];
  for (const row of data as { code?: unknown; name?: unknown }[]) {
    if (!isLocationCode(level, row?.code) || typeof row?.name !== "string") continue;
    const name = row.name.trim().slice(0, 80);
    if (name) out.push({ code: row.code, name });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "id"));
}

function locationKey(level: LocationLevel, parent: string | null): string {
  return level === "province" ? "loc:province" : `loc:${level}:${parent}`;
}

const LOCATION_PATH: Record<LocationLevel, string> = {
  province: "/v1/locations/provinces",
  city: "/v1/locations/cities",
  district: "/v1/locations/districts",
};

/**
 * Daftar wilayah dari cache (30 hari) atau api.co.id. `parent` WAJIB anggota
 * daftar level di atasnya — kode acak ditolak tanpa memanggil upstream, sehingga
 * panggilan upstream terbatas pada jumlah wilayah nyata.
 * `onUpstream` dipanggil sebelum panggilan upstream (untuk rate limit saat miss);
 * mengembalikan false = batalkan.
 */
export async function getLocations(
  level: LocationLevel,
  parent: string | null,
  onUpstream: () => Promise<boolean>
): Promise<Location[] | null> {
  if (level === "city") {
    if (!isLocationCode("province", parent)) return null;
    const provinces = await getLocations("province", null, onUpstream);
    if (!provinces?.some((p) => p.code === parent)) return null;
  } else if (level === "district") {
    if (!isLocationCode("city", parent)) return null;
    const cities = await getLocations("city", parent.slice(0, 2), onUpstream);
    if (!cities?.some((c) => c.code === parent)) return null;
  }
  const key = locationKey(level, parent);
  const cached = await cacheGet<Location[]>(key);
  if (cached?.fresh && cached.value.length > 0) return cached.value;

  if (!(await onUpstream())) return cached?.value.length ? cached.value : null;
  const params: Record<string, string> =
    level === "city" ? { province: parent! } : level === "district" ? { city: parent! } : {};
  const res = await apiCoIdGet<unknown>(LOCATION_PATH[level], params);
  if (!res.ok) {
    // Hanya key ditolak / saldo habis yang membuka circuit tarif: 429 dari endpoint
    // wilayah (tanpa captcha) tidak boleh mematikan estimasi untuk semua pelanggan.
    if (res.kind === "auth" || res.kind === "balance") await maybeOpenCircuit(res.kind);
    return cached?.value.length ? cached.value : null; // cache basi lebih baik daripada kosong
  }
  const list = normalizeLocations(level, res.data);
  if (list.length > 0) await cachePut(key, list, LOCATION_TTL_MS);
  return list.length > 0 ? list : null;
}

/**
 * Kecamatan tujuan valid (anggota cache wilayah) → label "Kec. X, Kota Y, Provinsi Z".
 * Hanya membaca cache (tanpa upstream): kecamatan yang dipilih pelanggan pasti
 * sudah dimuat lewat /api/shipping/locations.
 */
export async function describeDistrict(districtCode: unknown): Promise<{ code: string; label: string } | null> {
  if (!isLocationCode("district", districtCode)) return null;
  const city = districtCode.slice(0, 4);
  const prov = districtCode.slice(0, 2);
  const entries = await cacheGetMany<Location[]>([
    locationKey("province", null),
    locationKey("city", prov),
    locationKey("district", city),
  ]);
  const find = (key: string, code: string) => entries.get(key)?.value.find((l) => l.code === code)?.name;
  const d = find(locationKey("district", city), districtCode);
  const c = find(locationKey("city", prov), city);
  const p = find(locationKey("province", null), prov);
  if (!d || !c || !p) return null;
  return { code: districtCode, label: `Kec. ${d}, ${c}, ${p}` };
}

// ------------------------------------------------------------------ tarif

/** Berat dibulatkan ke atas per 100 g; null bila melewati batas estimasi. */
export function weightBucket(grams: number): number | null {
  if (!(grams > 0)) return null;
  const bucket = Math.ceil(grams / WEIGHT_STEP_GRAMS) * WEIGHT_STEP_GRAMS;
  return bucket <= MAX_WEIGHT_GRAMS ? bucket : null;
}

function rateKey(origin: string, dest: string, bucket: number): string {
  return `rate:${origin}:${dest}:${bucket}`;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function normalizeRates(data: unknown): ShippingRate[] {
  const rows = (data as { rates?: unknown })?.rates;
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const out: ShippingRate[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const courierCode = str(r?.courier_code, 30);
    const serviceCode = str(r?.service_code, 40);
    const type = str(r?.service_type, 20).toLowerCase();
    const normal = Number(r?.normal_price);
    if (!/^[a-z0-9_]+$/.test(courierCode) || !serviceCode || !ALLOWED_SERVICE_TYPES.has(type)) continue;
    if (!Number.isFinite(normal) || normal <= 0 || normal > 10_000_000) continue;
    const id = `${courierCode}|${serviceCode}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      courierCode,
      courierName: str(r?.courier_name, 60) || courierCode.toUpperCase(),
      serviceCode,
      serviceName: str(r?.service_name, 60) || serviceCode,
      etd: str(r?.etd, 20) || null,
      price: Math.ceil(normal / PRICE_STEP) * PRICE_STEP,
    });
  }
  return out.sort((a, b) => a.price - b.price).slice(0, MAX_RATES);
}

export type CachedRates = { rates: ShippingRate[]; fetchedAt: string };

/** Tarif dari cache. `maxAgeMs` membatasi umur (untuk pesanan); default: hanya yang masih segar. */
export async function readCachedRates(
  origin: string,
  dest: string,
  bucket: number,
  maxAgeMs?: number
): Promise<CachedRates | null> {
  const entry = await cacheGet<ShippingRate[]>(rateKey(origin, dest, bucket));
  if (!entry) return null;
  const ok =
    maxAgeMs === undefined ? entry.fresh : Date.now() - Date.parse(entry.fetchedAt) <= maxAgeMs;
  return ok ? { rates: entry.value, fetchedAt: entry.fetchedAt } : null;
}

/** Panggil api.co.id (Rp 5 bila sukses), normalisasi, simpan ke cache. */
export async function fetchRates(
  origin: string,
  dest: string,
  bucket: number
): Promise<{ ok: true; value: CachedRates } | { ok: false; kind: ApiCoIdErrorKind }> {
  const res = await apiCoIdGet<unknown>("/v2/rates", {
    origin_district_code: origin,
    destination_district_code: dest,
    weight: String(bucket / 1000), // kilogram (31b), maks 1 desimal karena bucket 100 g
    sender_type: "dropped",
  });
  if (!res.ok) {
    await maybeOpenCircuit(res.kind);
    // Rute tidak dilayani (422, 31b) = jawaban sah → cache negatif singkat.
    // 400/404 (parameter salah) tidak di-cache agar tidak menyamar sebagai "tidak dilayani".
    if (res.kind === "invalid" && res.status === 422) {
      const fetchedAt = await cachePut(rateKey(origin, dest, bucket), [], EMPTY_RATE_TTL_MS);
      return { ok: true, value: { rates: [], fetchedAt } };
    }
    return { ok: false, kind: res.kind };
  }
  const rates = normalizeRates(res.data);
  const fetchedAt = await cachePut(
    rateKey(origin, dest, bucket),
    rates,
    rates.length > 0 ? RATE_TTL_MS : EMPTY_RATE_TTL_MS
  );
  return { ok: true, value: { rates, fetchedAt } };
}

// ---------------------------------------------------------------- pesanan

export type OrderShippingResult =
  | { kind: "none" } // fitur mati / tanpa kecamatan → perilaku lama
  | { kind: "invalid-district" }
  | { kind: "required"; districtLabel: string } // tarif tersedia tapi tidak dipilih
  | {
      kind: "ok";
      districtCode: string;
      districtLabel: string;
      courierCode: string | null;
      snapshot: ShippingSnapshot | null;
      quotedAt: string | null;
      /** Pilihan pelanggan tidak bisa diverifikasi (cache kedaluwarsa/berat berubah). */
      dropped: boolean;
    };

/**
 * Cocokkan pilihan ongkir pelanggan dengan cache tarif SERVER (tanpa panggilan
 * upstream). Harga dari klien tidak pernah dipakai.
 */
export async function resolveOrderShipping(
  input: { districtCode?: unknown; courierCode?: unknown; serviceCode?: unknown } | null,
  weightGrams: number | null
): Promise<OrderShippingResult> {
  const cfg = getShippingConfig();
  if (!input || input.districtCode == null || input.districtCode === "") return { kind: "none" };
  const district = await describeDistrict(input.districtCode);
  if (!district) return { kind: "invalid-district" };

  const base = { districtCode: district.code, districtLabel: district.label };
  const bucket = weightGrams === null ? null : weightBucket(weightGrams);
  const raw =
    cfg.enabled && bucket !== null
      ? await readCachedRates(cfg.origin, district.code, bucket, RATE_ORDER_GRACE_MS)
      : null;
  // Hanya kurir yang aktif di pengaturan admin (Skill 32), sama seperti /api/shipping/rates.
  let cached = raw;
  if (raw && raw.rates.length > 0) {
    const disabled = await getDisabledCourierCodes();
    cached = { ...raw, rates: raw.rates.filter((r) => isApiCourierAllowed(r.courierCode, disabled)) };
  }
  const courierCode = str(input.courierCode, 30);
  const serviceCode = str(input.serviceCode, 40);

  if (!courierCode || !serviceCode) {
    // Tarif masih ada di cache → pelanggan wajib memilih (keputusan pemilik 31a).
    if (cached && cached.rates.length > 0) return { kind: "required", districtLabel: district.label };
    return { ...base, kind: "ok", courierCode: null, snapshot: null, quotedAt: null, dropped: false };
  }
  const rate = cached?.rates.find((r) => r.courierCode === courierCode && r.serviceCode === serviceCode);
  if (!rate || bucket === null || !cached) {
    return { ...base, kind: "ok", courierCode: null, snapshot: null, quotedAt: null, dropped: true };
  }
  return {
    ...base,
    kind: "ok",
    courierCode: rate.courierCode,
    snapshot: {
      courierName: rate.courierName,
      serviceName: rate.serviceName,
      etd: rate.etd,
      price: rate.price,
      weightGrams: bucket,
    },
    quotedAt: cached.fetchedAt,
    dropped: false,
  };
}
