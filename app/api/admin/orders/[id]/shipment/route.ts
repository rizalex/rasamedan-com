import { NextResponse } from "next/server";
import { dbErrorMessage, execute, query } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { WAYBILL_PATTERN, findCourier } from "@/lib/couriers.mjs";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/orders/[id]/shipment — simpan kurir & nomor resi (Skill 22.2).
 * Body: { courier_code, waybill }. Keduanya kosong = hapus data pengiriman.
 * Hanya untuk pesanan bermetode `kurir`. Status pesanan TIDAK diubah di sini
 * (tetap manual lewat PATCH /api/admin/orders/[id], PRD §2.1).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 401 });
  }
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId < 1) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
  }

  let body: { courier_code?: unknown; waybill?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const courierCode = String(body.courier_code ?? "").trim();
  // Resi disimpan huruf besar tanpa spasi (format kurir), agar mudah dicocokkan.
  const waybill = String(body.waybill ?? "").trim().toUpperCase();
  const clearing = !courierCode && !waybill;

  if (!clearing) {
    if (!findCourier(courierCode)) {
      return NextResponse.json({ error: "Kurir tidak dikenal" }, { status: 400 });
    }
    if (!WAYBILL_PATTERN.test(waybill)) {
      return NextResponse.json(
        { error: "Nomor resi harus 6–40 karakter: huruf, angka, atau tanda -" },
        { status: 400 }
      );
    }
  }

  try {
    const rows = await query<{ fulfillment_method: string }>(
      "SELECT fulfillment_method FROM orders WHERE id = ? LIMIT 1",
      [orderId]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
    }
    if (rows[0].fulfillment_method !== "kurir") {
      return NextResponse.json(
        { error: "Resi hanya untuk pesanan bermetode kurir" },
        { status: 400 }
      );
    }

    if (clearing) {
      await execute(
        `UPDATE orders SET courier_code = NULL, waybill = NULL, shipped_at = NULL,
                tracking_summary = NULL, tracking_checked_at = NULL WHERE id = ?`,
        [orderId]
      );
      return NextResponse.json({ ok: true, courier_code: null, waybill: null });
    }

    // shipped_at diisi saat resi pertama kali disimpan; ganti resi/kurir →
    // ringkasan tracking lama tidak berlaku lagi.
    await execute(
      `UPDATE orders
          SET tracking_summary = CASE WHEN waybill IS ? AND courier_code IS ? THEN tracking_summary END,
              tracking_checked_at = CASE WHEN waybill IS ? AND courier_code IS ? THEN tracking_checked_at END,
              courier_code = ?, waybill = ?,
              shipped_at = COALESCE(shipped_at, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        WHERE id = ?`,
      [waybill, courierCode, waybill, courierCode, courierCode, waybill, orderId]
    );
    return NextResponse.json({ ok: true, courier_code: courierCode, waybill });
  } catch (err) {
    console.error("PATCH /api/admin/orders/shipment gagal:", dbErrorMessage(err));
    return NextResponse.json({ error: "Gagal menyimpan resi" }, { status: 500 });
  }
}
