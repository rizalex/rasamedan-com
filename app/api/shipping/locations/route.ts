import { NextResponse } from "next/server";
import { getClientIp, rateLimitKeyFromIp } from "@/lib/client-ip";
import { consumeRateLimit } from "@/lib/rate-limit";
import { dbErrorMessage } from "@/lib/db";
import { getLocations, getShippingConfig, type LocationLevel } from "@/lib/shipping";

/**
 * Daftar wilayah tujuan untuk estimasi ongkir (Skill 31.4):
 *   GET /api/shipping/locations?level=province|city|district&parent=<kode>
 * Data publik (gratis di api.co.id), di-cache 30 hari di D1. `parent` harus
 * anggota daftar level di atasnya (dicek lib/shipping.ts). Rate limit hanya saat
 * cache miss (cache hit tidak menulis D1). Gagal → `{ available: false }` (HTTP 200)
 * agar checkout kembali ke input teks kecamatan/kota.
 */

export const dynamic = "force-dynamic";

const LEVELS: LocationLevel[] = ["province", "city", "district"];
const MISS_LIMIT = 60;
const MISS_WINDOW_MS = 10 * 60 * 1000;

const unavailable = () => NextResponse.json({ available: false });

export async function GET(req: Request) {
  if (!getShippingConfig().enabled) return unavailable();
  const url = new URL(req.url);
  const level = url.searchParams.get("level") as LocationLevel;
  const parent = url.searchParams.get("parent");
  if (!LEVELS.includes(level)) {
    return NextResponse.json({ error: "level tidak valid" }, { status: 400 });
  }
  if (level !== "province" && !parent) {
    return NextResponse.json({ error: "parent wajib" }, { status: 400 });
  }

  const ipKey = rateLimitKeyFromIp(getClientIp(req));
  let limited = false;
  try {
    const list = await getLocations(level, level === "province" ? null : parent, async () => {
      const rl = await consumeRateLimit(`shiploc:${ipKey}`, MISS_LIMIT, MISS_WINDOW_MS);
      limited = rl.limited;
      return !rl.limited;
    });
    if (!list) {
      return limited
        ? NextResponse.json({ available: false, reason: "RATE_LIMITED" }, { status: 429 })
        : unavailable();
    }
    return NextResponse.json(
      { available: true, locations: list },
      { headers: { "Cache-Control": "public, max-age=86400" } }
    );
  } catch (err) {
    console.error("GET /api/shipping/locations gagal:", dbErrorMessage(err));
    return unavailable();
  }
}
