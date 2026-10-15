import ProductForm from "@/components/admin/ProductForm";
import { getAdminCategories } from "@/lib/categories";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const categories = await getAdminCategories();
  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Tambah Produk</h1>
      <p className={styles.pageDesc}>Isi detail produk baru.</p>
      <ProductForm categories={categories} />
    </div>
  );
}
