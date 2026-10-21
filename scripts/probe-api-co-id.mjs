/**
 * Uji gerbang Skill 31.0 (sekali pakai, dijalankan pemilik). Mencari kode wilayah
 * otomatis lalu mengambil sampel tarif api.co.id ke docs/api-co-id-probe/.
 *
 * Git Bash (key tidak tampil & tidak tersimpan di riwayat):
 *   read -s -p "Live API key: " K; echo; API_CO_ID_KEY="$K" node scripts/probe-api-co-id.mjs "Medan Baru"; unset K
 * Argumen = nama kecamatan toko di Kota Medan (default "Medan Baru").
 *
 * Biaya: ±11 panggilan tarif × Rp 5. Endpoint wilayah & kurir gratis.
 * Hasil di docs/api-co-id-probe/ JANGAN di-commit sebelum disanitasi.
 */
import { mkdirSync, writeFileSync } from "node:fs";

const KEY = process.env.API_CO_ID_KEY;
if (!KEY) {
  console.error("❌ API_CO_ID_KEY kosong — lihat cara menjalankan di kepala file.");
  process.exit(1);
}
const BASE = "https://use.api.co.id/courier";
const OUT = "docs/api-co-id-probe";
mkdirSync(OUT, { recursive: true });

async function call(path, params, file) {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  const started = Date.now();
  const res = await fetch(url, { headers: { "x-api-co-id": KEY } });
  const text = await res.text();
  writeFileSync(`${OUT}/${file}.json`, text);
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* bukan JSON */
  }
  console.log(`${res.status} ${Date.now() - started}ms ${file} — ${body?.message ?? text.slice(0, 80)}`);
  return body;
}

const find = (list, re) => (list ?? []).find((x) => re.test(x.name));

async function district(provinceCode, cityRe, districtRe, tag) {
  const cities = await call("/v1/locations/cities", { province: provinceCode }, `cities-${tag}`);
  const city = find(cities?.data, cityRe);
  if (!city) return console.error(`❌ kota ${cityRe} tidak ditemukan`), null;
  const districts = await call("/v1/locations/districts", { city: city.code }, `districts-${tag}`);
  const d = districtRe ? find(districts?.data, districtRe) : districts?.data?.[0];
  if (!d) return console.error(`❌ kecamatan ${districtRe} tidak ditemukan di ${city.name}`), null;
  console.log(`   → ${tag}: ${d.name}, ${city.name} = ${d.code}`);
  return d.code;
}

const shopName = process.argv[2] ?? "Medan Baru";
const origin = await district("12", /^Kota Medan$/i, new RegExp(`^${shopName}$`, "i"), "medan-origin");
const destMedan = await district("12", /^Kota Medan$/i, /^Medan Johor$/i, "medan");
const destJakarta = await district("31", /Jakarta Pusat/i, /Kemayoran/i, "jakarta");
const destTimur = await district("91", /Jayapura/i, null, "jayapura");
if (!origin) process.exit(1);

for (const [tag, dest] of [["medan", destMedan], ["jakarta", destJakarta], ["jayapura", destTimur]]) {
  if (!dest) continue;
  for (const weight of [500, 1000, 2500]) {
    await call("/v2/rates", { origin_district_code: origin, destination_district_code: dest, weight, sender_type: "dropped" }, `rates-${tag}-${weight}-dropped`);
  }
}
// Pembanding: tanpa sender_type (default "picked up").
if (destJakarta) await call("/v2/rates", { origin_district_code: origin, destination_district_code: destJakarta, weight: 1000 }, "rates-jakarta-1000-default");
// Uji error (gratis bila gagal): kode tujuan salah & berat 0.
await call("/v2/rates", { origin_district_code: origin, destination_district_code: "9999999", weight: 1000, sender_type: "dropped" }, "err-bad-dest");
await call("/v2/rates", { origin_district_code: origin, destination_district_code: destMedan ?? origin, weight: 0, sender_type: "dropped" }, "err-weight-0");
console.log(`✅ Selesai — hasil di ${OUT}/`);
