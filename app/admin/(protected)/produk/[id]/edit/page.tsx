import { notFound } from "next/navigation";
import ProductForm from "@/components/admin/ProductForm";
import { getProductById } from "@/lib/products";
import { getAllCategories } from "@/lib/categories";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    getProductById(Number(id)),
    getAllCategories(),
  ]);
  if (!product) notFound();

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Edit Produk</h1>
      <p className={styles.pageDesc}>{product.name}</p>
      <ProductForm product={product} categories={categories} />
    </div>
  );
}
