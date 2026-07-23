"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/products";
import type { Category } from "@/lib/categories";
import styles from "./admin.module.css";

const STOCKS = ["tersedia", "terbatas", "pre-order", "tanya-stok"];

export default function ProductForm({
  product,
  categories,
}: {
  product?: Product;
  categories: Category[];
}) {
  const router = useRouter();
  const isEdit = !!product;

  const [form, setForm] = useState<{
    name: string;
    slug: string;
    category: string;
    price: string;
    weight_grams: string;
    stock_status: string;
    is_halal: boolean;
    description: string;
    ingredients: string;
    variants: string;
  }>({
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    category: product?.category ?? categories[0]?.slug ?? "",
    price: product ? String(product.price) : "",
    weight_grams: product?.weight_grams ? String(product.weight_grams) : "",
    stock_status: product?.stock_status ?? "tersedia",
    is_halal: product?.is_halal ?? true,
    description: product?.description ?? "",
    ingredients: product?.ingredients ?? "",
    variants: product?.variants.join(", ") ?? "",
  });
  const [image, setImage] = useState<string | null>(product?.image ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Gagal mengunggah");
      else setImage(data.url);
    } catch {
      setError("Gagal mengunggah gambar");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload = {
      name: form.name,
      slug: form.slug,
      category: form.category,
      price: Number(form.price),
      weight_grams: Number(form.weight_grams),
      stock_status: form.stock_status,
      is_halal: form.is_halal,
      description: form.description,
      ingredients: form.ingredients,
      image,
      variants: form.variants
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    };
    try {
      const res = await fetch(
        isEdit ? `/api/admin/products/${product!.id}` : "/api/admin/products",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan");
        setSaving(false);
        return;
      }
      router.push("/admin/produk");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <label className={styles.field}>
        <span>Nama produk *</span>
        <input value={form.name} onChange={(e) => set("name", e.target.value)} required />
      </label>

      <label className={styles.field}>
        <span>Slug (opsional — dibuat otomatis dari nama)</span>
        <input
          value={form.slug}
          onChange={(e) => set("slug", e.target.value)}
          placeholder="mis. bika-ambon-original"
        />
      </label>

      <div className={styles.grid2}>
        <label className={styles.field}>
          <span>Kategori *</span>
          <select value={form.category} onChange={(e) => set("category", e.target.value)}>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Harga (Rp) *</span>
          <input
            type="number"
            min={0}
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
            required
          />
        </label>
      </div>

      <label className={styles.field}>
        <span>Berat (gram) *</span>
        <input
          type="number"
          min={1}
          step={1}
          value={form.weight_grams}
          onChange={(e) => set("weight_grams", e.target.value)}
          placeholder="mis. 500"
          required
        />
        <span className={styles.hint}>
          Dipakai untuk menghitung total berat pesanan di pesan WhatsApp.
        </span>
      </label>

      <label className={styles.field}>
        <span>Status stok *</span>
        <select
          value={form.stock_status}
          onChange={(e) => set("stock_status", e.target.value)}
        >
          {STOCKS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={form.is_halal}
          onChange={(e) => set("is_halal", e.target.checked)}
        />
        Produk halal
      </label>

      <label className={styles.field}>
        <span>Varian (pisahkan dengan koma)</span>
        <input
          value={form.variants}
          onChange={(e) => set("variants", e.target.value)}
          placeholder="Original, Pandan, Durian"
        />
      </label>

      <label className={styles.field}>
        <span>Deskripsi</span>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span>Bahan-bahan</span>
        <textarea
          rows={2}
          value={form.ingredients}
          onChange={(e) => set("ingredients", e.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span>Foto produk (JPG/PNG/WEBP, maks 2 MB)</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
        {uploading && <span className={styles.hint}>Mengunggah…</span>}
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className={styles.thumb} style={{ marginTop: 6 }} />
        )}
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" className={styles.btn} disabled={saving || uploading}>
          {saving ? "Menyimpan…" : isEdit ? "Simpan perubahan" : "Tambah produk"}
        </button>
        <button
          type="button"
          className={styles.btnGhost}
          onClick={() => router.push("/admin/produk")}
          style={{ padding: "9px 16px", borderRadius: 8, fontSize: 13 }}
        >
          Batal
        </button>
      </div>
    </form>
  );
}
