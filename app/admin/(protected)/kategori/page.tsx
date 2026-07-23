import CategoryManager from "@/components/admin/CategoryManager";
import { getCategoriesWithCounts } from "@/lib/categories";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await getCategoriesWithCounts();

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Kelola Kategori</h1>
      <p className={styles.pageDesc}>
        Tambah, ubah nama, atau hapus kategori. Kategori langsung muncul sebagai
        filter di katalog. Kategori yang masih dipakai produk tidak bisa dihapus.
      </p>
      <CategoryManager categories={categories} />
    </div>
  );
}
