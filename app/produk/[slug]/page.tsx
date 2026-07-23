import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ProductDetail from "@/components/product/ProductDetail";
import JsonLd from "@/components/seo/JsonLd";
import { getProductBySlug } from "@/lib/products";
import { getAllCategories } from "@/lib/categories";
import {
  buildMetadata,
  productJsonLd,
  breadcrumbJsonLd,
  SITE_TAGLINE,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

/** Nama tampil kategori dari slug (fallback: kapitalisasi slug bila tak ditemukan). */
async function categoryName(slug: string): Promise<string> {
  const categories = await getAllCategories();
  const found = categories.find((c) => c.slug === slug);
  if (found) return found.name;
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) {
    return buildMetadata({
      title: "Produk tidak ditemukan",
      description: "Produk yang Anda cari tidak tersedia di Rasa Medan.",
      path: `/produk/${slug}`,
      index: false,
    });
  }

  const catName = await categoryName(product.category);
  const description =
    product.description ||
    `${product.name} — ${catName} oleh-oleh khas Medan dari Rasa Medan. Pesan tanpa akun, konfirmasi via WhatsApp.`;

  return buildMetadata({
    title: `${product.name} - ${SITE_TAGLINE}`,
    description,
    path: `/produk/${product.slug}`,
    image: product.image,
    type: "article",
  });
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const catName = await categoryName(product.category);

  return (
    <>
      <JsonLd data={productJsonLd(product, catName)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Beranda", path: "/" },
          { name: catName, path: `/produk?category=${product.category}` },
          { name: product.name, path: `/produk/${product.slug}` },
        ])}
      />
      <Header />
      <ProductDetail product={product} />
      <Footer />
    </>
  );
}
