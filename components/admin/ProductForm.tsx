"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/products";
import type { Category } from "@/lib/categories";
import { formatRupiah, formatWeight } from "@/lib/format";
import styles from "./admin.module.css";

const STOCKS = ["tersedia", "terbatas", "pre-order", "tanya-stok"];

/** Baris editor varian; nilai angka disimpan sebagai string selama diedit. */
type VariantRow = { key: number; name: string; price_delta: string; weight_grams: string };

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
    is_featured: boolean;
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
    is_featured: product?.is_featured ?? false,
  });
  // Kunci baris dari counter (bukan acak/indeks) agar React tidak salah
  // mencocokkan input saat baris dihapus atau dipindah.
  const nextKey = useRef(0);
  const [variants, setVariants] = useState<VariantRow[]>(() =>
    (product?.variants ?? []).map((v) => ({
      key: nextKey.current++,
      name: v.name,
      price_delta: v.price_delta ? String(v.price_delta) : "",
      weight_grams: v.weight_grams ? String(v.weight_grams) : "",
    }))
  );
  const [image, setImage] = useState<string | null>(product?.image ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function updateVariant(key: number, patch: Partial<VariantRow>) {
    setVariants((list) => list.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  }
  function addVariant() {
    setVariants((list) => [
      ...list,
      { key: nextKey.current++, name: "", price_delta: "", weight_grams: "" },
    ]);
  }
  function removeVariant(key: number) {
    setVariants((list) => list.filter((v) => v.key !== key));
  }
  function moveVariant(key: number, dir: -1 | 1) {
    setVariants((list) => {
      const i = list.findIndex((v) => v.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  const basePrice = Number(form.price) || 0;

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
      is_featured: form.is_featured,
      image,
      // Urutan baris = urutan tampil (position). Validasi final di server.
      variants: variants.map((v) => ({
        name: v.name.trim(),
        price_delta: v.price_delta.trim() === "" ? 0 : Number(v.price_delta),
        weight_grams: v.weight_grams.trim() === "" ? 0 : Number(v.weight_grams),
      })),
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

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={form.is_featured}
          onChange={(e) => set("is_featured", e.target.checked)}
        />
        Tampilkan di beranda (produk pilihan)
      </label>

      <fieldset className={styles.variantSet}>
        <legend>Varian (opsional)</legend>
        <p className={styles.hint} style={{ marginTop: 0 }}>
          Harga jual varian = harga produk + selisih (boleh minus). Berat kosong =
          ikut berat produk. Bila ada varian, pembeli wajib memilih salah satu.
        </p>
        {variants.map((v, i) => {
          const delta = Number(v.price_delta) || 0;
          const sale = basePrice + delta;
          const weight = Number(v.weight_grams) || Number(form.weight_grams) || 0;
          return (
            <div key={v.key} className={styles.variantRow}>
              <label className={styles.field}>
                <span>Nama varian *</span>
                <input
                  value={v.name}
                  onChange={(e) => updateVariant(v.key, { name: e.target.value })}
                  placeholder="mis. Botol 1 Liter"
                  maxLength={100}
                  required
                />
              </label>
              <div className={styles.grid2}>
                <label className={styles.field}>
                  <span>Selisih harga (Rp)</span>
                  <input
                    type="number"
                    step={1}
                    value={v.price_delta}
                    onChange={(e) => updateVariant(v.key, { price_delta: e.target.value })}
                    placeholder="0"
                  />
                </label>
                <label className={styles.field}>
                  <span>Berat (gram)</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={v.weight_grams}
                    onChange={(e) => updateVariant(v.key, { weight_grams: e.target.value })}
                    placeholder="ikut produk"
                  />
                </label>
              </div>
              <div className={styles.variantActions}>
                <span className={sale < 0 ? styles.errorText : styles.hint}>
                  Harga jual: {formatRupiah(sale)} · berat {formatWeight(weight)}
                </span>
                <span className={styles.variantButtons}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => moveVariant(v.key, -1)}
                    disabled={i === 0}
                    aria-label={`Naikkan varian ${v.name}`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => moveVariant(v.key, 1)}
                    disabled={i === variants.length - 1}
                    aria-label={`Turunkan varian ${v.name}`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    onClick={() => removeVariant(v.key)}
                  >
                    Hapus
                  </button>
                </span>
              </div>
            </div>
          );
        })}
        <button type="button" className={styles.btnGhost} onClick={addVariant}>
          + Tambah varian
        </button>
      </fieldset>

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
