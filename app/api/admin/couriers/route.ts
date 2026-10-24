import { NextResponse } from "next/server";
import { dbErrorMessage } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { COURIERS, OTHER_COURIER_CODE, findCourier } from "@/lib/couriers.mjs";
import { getDisabledCourierCodes, setCourierEnabled } from "@/lib/courier-settings";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/couriers — aktif/nonaktifkan kurir agen (Skill 32).
 * Body: { code, enabled }. "Kurir lain" tidak bisa dinonaktifkan.
 */
export async function PATCH(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 401 });
  }
  let body: { code?: unknown; enabled?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const code = String(body.code ?? "");
  if (!findCourier(code) || code === OTHER_COURIER_CODE) {
    return NextResponse.json({ error: "Kurir tidak dikenal" }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Nilai aktif tidak valid" }, { status: 400 });
  }
  try {
    // Minimal satu kurir ber-tarif (ada di api.co.id) tetap aktif — dicek di
    // server, bukan hanya UI (permintaan langsung / dua tab admin).
    if (!body.enabled) {
      const disabled = await getDisabledCourierCodes();
      disabled.add(code);
      const ratedLeft = COURIERS.some((c) => c.apiCode !== null && !disabled.has(c.code));
      if (!ratedLeft) {
        return NextResponse.json(
          { error: "Minimal satu kurir dengan estimasi ongkir harus tetap aktif." },
          { status: 400 }
        );
      }
    }
    await setCourierEnabled(code, body.enabled);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/admin/couriers gagal:", dbErrorMessage(err));
    return NextResponse.json({ error: "Gagal menyimpan pengaturan kurir" }, { status: 500 });
  }
}
