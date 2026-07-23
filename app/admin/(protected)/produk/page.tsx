import Link from "next/link";
import { getAllProducts } from "@/lib/products";
import { formatRupiah } from "@/lib/format";
import DeleteProductButton from "@/components/admin/DeleteProductButton";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = await getAllProducts();

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div>
          <h1 className={styles.pageTitle}>Produk</h1>
          <p className={styles.pageDesc} style={{ margin: 0 }}>
            {products.length} produk
          </p>
        </div>
        <Link href="/admin/produk/baru" className={styles.btn}>
          + Tambah produk
        </Link>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Foto</th>
              <th>Nama</th>
              <th>Kategori</th>
              <th>Harga</th>
              <th>Berat</th>
              <th>Stok</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt={p.name} className={styles.thumb} />
                  ) : (
                    <span className={styles.hint}>—</span>
                  )}
                </td>
                <td>
                  <strong>{p.name}</strong>
                  <div className={styles.hint}>{p.slug}</div>
                  {p.variants.length > 0 && (
                    <div className={styles.hint}>
                      Varian: {p.variants.join(", ")}
                    </div>
                  )}
                </td>
                <td style={{ textTransform: "capitalize" }}>{p.category}</td>
                <td>{formatRupiah(p.price)}</td>
                <td style={{ whiteSpace: "nowrap" }}>{p.weight_grams} g</td>
                <td>{p.stock_status}</td>
                <td>
                  <div style={{ display: "flex", gap: 8, whiteSpace: "nowrap" }}>
                    <Link
                      href={`/admin/produk/${p.id}/edit`}
                      className={styles.btnGhost}
                      style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13 }}
                    >
                      Edit
                    </Link>
                    <DeleteProductButton id={p.id} name={p.name} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
