import type { MetadataRoute } from "next";
import { getAllProducts } from "@/lib/products";
import { getAllCategories } from "@/lib/categories";
import { absoluteUrl } from "@/lib/seo";

// Regenerate tiap request agar produk/kategori baru langsung ikut (butuh DB runtime).
export const dynamic = "force-dynamic";

/**
 * sitemap.xml otomatis (Skill 19.4): halaman statis publik + semua kategori +
 * semua produk. Halaman transaksional (keranjang/checkout/cek-pesanan) & admin
 * sengaja tidak dimasukkan (noindex / privat).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/produk"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/tentang"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/kontak"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  const [products, categories] = await Promise.all([
    getAllProducts(),
    getAllCategories(),
  ]);

  const categoryPages: MetadataRoute.Sitemap = categories.map((c) => ({
    url: absoluteUrl(`/produk?category=${c.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const productPages: MetadataRoute.Sitemap = products.map((p) => ({
    url: absoluteUrl(`/produk/${p.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticPages, ...categoryPages, ...productPages];
}
