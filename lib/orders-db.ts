import { pool } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

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
  created_at: string;
  items: AdminOrderItem[];
};

interface OrderRow extends RowDataPacket, Omit<AdminOrder, "items"> {}
interface ItemRow extends RowDataPacket, AdminOrderItem {
  order_id: number;
}

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
  if (filter.q) {
    where.push("(order_code LIKE ? OR phone LIKE ?)");
    params.push(`%${filter.q}%`, `%${filter.q}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [orders] = await pool.query<OrderRow[]>(
    `SELECT id, order_code, recipient_name, phone, fulfillment_method,
            address, city, location_note, note, status, total_estimate, created_at
       FROM orders ${whereSql}
      ORDER BY created_at DESC
      LIMIT 200`,
    params
  );
  if (orders.length === 0) return [];

  const ids = orders.map((o) => o.id);
  const [items] = await pool.query<ItemRow[]>(
    `SELECT order_id, product_name, variant, quantity, unit_price
       FROM order_items WHERE order_id IN (?)`,
    [ids]
  );

  return orders.map((o) => ({
    ...o,
    items: items.filter((it) => it.order_id === o.id),
  }));
}

/** Ringkasan jumlah pesanan per status (untuk dashboard). */
export async function getOrderStatusCounts(): Promise<Record<string, number>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT status, COUNT(*) AS n FROM orders GROUP BY status"
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = Number(r.n);
  return out;
}
