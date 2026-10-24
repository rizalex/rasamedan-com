import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CatalogView from "@/components/catalog/CatalogView";
import { getAllProducts } from "@/lib/products";
import { getAllCategories } from "@/lib/categories";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const categories = await getAllCategories();
  const active = params.category
    ? categories.find((c) => c.slug === params.category)
    : undefined;
  const isSearch = Boolean(params.q);

  if (active) {
    // Kategori valid: canonical menunjuk URL kategori itu sendiri.
    return buildMetadata({
      title: `${active.name} Khas Medan - Oleh-oleh Sumatera Utara`,
      description: `Koleksi ${active.name.toLowerCase()} khas Medan dari toko oleh-oleh Rasa Medan, Sumatera Utara. Pesan tanpa akun, kirim ke seluruh Indonesia, konfirmasi via WhatsApp.`,
      path: `/produk?category=${active.slug}`,
    });
  }

  return buildMetadata({
    title: "Katalog Oleh-oleh Khas Medan - Kue, Camilan & Sirup",
    description:
      "Belanja oleh-oleh khas Medan, Sumatera Utara: Bika Ambon, kue, makanan kering, dan sirup. Cari produk, pilih varian, kirim ke seluruh Indonesia via WhatsApp.",
    // Hasil pencarian (?q=) tidak diindeks & canonical dikembalikan ke katalog bersih.
    path: "/produk",
    index: !isSearch,
  });
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const [products, categories, params] = await Promise.all([
    getAllProducts(),
    getAllCategories(),
    searchParams,
  ]);

  return (
    <>
      <Header />
      {/* key: remount saat query URL berubah (mis. cari dari Header saat sudah di
          /produk, atau pindah kategori lewat tautan) — state filter dibaca saat mount. */}
      <CatalogView
        key={`${params.category ?? "all"}|${params.q ?? ""}`}
        products={products}
        categories={categories}
        initialCategory={params.category ?? "all"}
        initialQuery={params.q ?? ""}
      />
      <Footer />
    </>
  );
}
