import { getAdminOrders } from "@/lib/orders-db";
import { formatRupiah, formatDateTime } from "@/lib/format";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

const STATUSES = [
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

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "";
  const q = sp.q ?? "";
  const orders = await getAdminOrders({ status, q });

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Pesanan</h1>
      <p className={styles.pageDesc}>
        Ubah status pesanan — perubahan langsung terlihat pelanggan di halaman
        &quot;Cek Pesanan&quot;.
      </p>

      {/* Filter */}
      <form method="get" className={styles.row}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select name="status" defaultValue={status} className={styles.statusSelect}>
            <option value="">Semua status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            name="q"
            defaultValue={q}
            placeholder="Cari no HP / Order ID"
            className={styles.statusSelect}
            style={{ minWidth: 200 }}
          />
          <button type="submit" className={styles.btn}>
            Filter
          </button>
        </div>
      </form>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Order ID / Tanggal</th>
              <th>Pelanggan</th>
              <th>Item</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "#5F5E5A" }}>
                  Tidak ada pesanan.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.order_code}</strong>
                    <div className={styles.hint}>
                      {formatDateTime(o.created_at)}
                    </div>
                  </td>
                  <td>
                    {o.recipient_name}
                    <div className={styles.hint}>{o.phone}</div>
                    <div className={styles.hint}>
                      {o.fulfillment_method === "kurir"
                        ? `Kurir · ${o.city ?? "-"}`
                        : "Ambil sendiri"}
                    </div>
                    {o.fulfillment_method === "kurir" && o.address && (
                      <div className={styles.hint}>{o.address}</div>
                    )}
                  </td>
                  <td>
                    {o.items.map((it, i) => (
                      <div key={i}>
                        {it.product_name}
                        {it.variant ? ` (${it.variant})` : ""} ×{it.quantity}
                      </div>
                    ))}
                  </td>
                  <td>
                    {o.total_estimate != null
                      ? formatRupiah(o.total_estimate)
                      : "-"}
                  </td>
                  <td>
                    <OrderStatusSelect orderId={o.id} current={o.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
