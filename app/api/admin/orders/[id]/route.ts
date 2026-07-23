import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Daftar status baku PRD 2.1 — hanya nilai ini yang boleh disimpan.
const VALID_STATUS = [
  "Menunggu Konfirmasi",
  "Stok Dikonfirmasi",
  "Menunggu Pembayaran",
  "Pembayaran Diverifikasi",
  "Dikemas",
  "Dikirim",
  "Siap Diambil",
  "Selesai",
  "Dibatalkan",
];

/** PATCH /api/admin/orders/[id] — ubah status pesanan. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 401 });
  }

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
  }

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const status = String(body.status ?? "");
  if (!VALID_STATUS.includes(status)) {
    return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
  }

  try {
    await pool.execute("UPDATE orders SET status = ? WHERE id = ?", [
      status,
      orderId,
    ]);
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    console.error("PATCH /api/admin/orders gagal:", err);
    return NextResponse.json({ error: "Gagal memperbarui status" }, { status: 500 });
  }
}
