import Link from "next/link";
import { getAllProducts } from "@/lib/products";
import { getOrderStatusCounts } from "@/lib/orders-db";
import { IconBox, IconClipboard, IconClock } from "@/components/ui/icons";
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

export default async function AdminHomePage() {
  const [products, counts] = await Promise.all([
    getAllProducts(),
    getOrderStatusCounts(),
  ]);
  const totalOrders = Object.values(counts).reduce((a, b) => a + b, 0);
  const needAttention =
    (counts["Menunggu Konfirmasi"] ?? 0) + (counts["Menunggu Pembayaran"] ?? 0);

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Dashboard</h1>
      <p className={styles.pageDesc}>Ringkasan aktivitas toko Rasa Medan.</p>

      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <span className={`${styles.statIcon} ${styles.statIconGreen}`}>
            <IconBox size={22} />
          </span>
          <div>
            <div className={styles.statNum}>{products.length}</div>
            <div className={styles.statLabel}>Produk</div>
          </div>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statIcon} ${styles.statIconGold}`}>
            <IconClipboard size={22} />
          </span>
          <div>
            <div className={styles.statNum}>{totalOrders}</div>
            <div className={styles.statLabel}>Total pesanan</div>
          </div>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statIcon} ${styles.statIconRed}`}>
            <IconClock size={22} />
          </span>
          <div>
            <div className={styles.statNum}>{needAttention}</div>
            <div className={styles.statLabel}>Perlu ditindak</div>
          </div>
        </div>
      </div>

      <div className={styles.row}>
        <h2 className={styles.pageTitle} style={{ fontSize: 16 }}>
          Pesanan per status
        </h2>
        <Link href="/admin/pesanan" className={styles.btn}>
          Kelola pesanan
        </Link>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <tbody>
            {STATUSES.map((s) => (
              <tr key={s}>
                <td>{s}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>
                  {counts[s] ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
