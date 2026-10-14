import { query, queryIn } from "@/lib/db";

/** Query pesanan sisi admin (server-only). Terpisah dari lib/orders.ts yang
 *  ikut ter-bundle ke client. */

export type AdminOrderItem = {
  product_name: string;
  variant: string | null;
  quantity: number;
  unit_price: number;
};

export type AdminOrder = {
  id: number;
  order_code: string;
  recipient_name: string;
  phone: string;
  fulfillment_method: string;
  address: string | null;
  city: string | null;
  location_note: string | null;
  note: string | null;
  status: string;
  total_estimate: number | null;
  /** ISO-8601 UTC, mis. "2026-10-14T03:00:00Z". */
  created_at: string;
  items: AdminOrderItem[];
};

type OrderRow = Omit<AdminOrder, "items">;
type ItemRow = AdminOrderItem & { order_id: number };

/** Daftar semua pesanan, filter opsional by status & q (order_code atau phone). */
export async function getAdminOrders(filter: {
  status?: string;
  q?: string;
}): Promise<AdminOrder[]> {
  const params: string[] = [];
  const where: string[] = [];
  if (filter.status) {
    where.push("status = ?");
    params.push(filter.status);
  }
  // Kata kunci = potongan Order ID atau nomor HP: hanya huruf, angka, dan "-".
  // Karakter lain (termasuk wildcard `%`/`_`) dibuang, dan panjang dibatasi
  // karena D1 menolak pola LIKE di atas 50 byte ("pattern too complex").
  const q = (filter.q ?? "").replace(/[^0-9A-Za-z-]/g, "").slice(0, 24);
  if (q) {
    where.push("(order_code LIKE ? OR phone LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const orders = await query<OrderRow>(
    `SELECT id, order_code, recipient_name, phone, fulfillment_method,
            address, city, location_note, note, status, total_estimate, created_at
       FROM orders ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT 200`,
    params
  );
  if (orders.length === 0) return [];

  const items = await queryIn<ItemRow>(
    (ph) => `SELECT order_id, product_name, variant, quantity, unit_price
       FROM order_items WHERE order_id IN (${ph})
      ORDER BY id ASC`,
    orders.map((o) => o.id)
  );

  return orders.map((o) => ({
    ...o,
    items: items.filter((it) => it.order_id === o.id),
  }));
}

/** Ringkasan jumlah pesanan per status (untuk dashboard). */
export async function getOrderStatusCounts(): Promise<Record<string, number>> {
  const rows = await query<{ status: string; n: number }>(
    "SELECT status, COUNT(*) AS n FROM orders GROUP BY status"
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = Number(r.n);
  return out;
}
