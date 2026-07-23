"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CategoryWithCount } from "@/lib/categories";
import styles from "./admin.module.css";

export default function CategoryManager({
  categories,
}: {
  categories: CategoryWithCount[];
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menambah kategori");
      } else {
        setNewName("");
        router.refresh();
      }
    } catch {
      setError("Terjadi kesalahan");
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveEdit(id: number) {
    setError(null);
    if (!editName.trim()) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal memperbarui kategori");
      } else {
        setEditingId(null);
        router.refresh();
      }
    } catch {
      setError("Terjadi kesalahan");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: number, name: string) {
    setError(null);
    if (!confirm(`Hapus kategori "${name}"?`)) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Gagal menghapus kategori");
      } else {
        router.refresh();
      }
    } catch {
      setError("Terjadi kesalahan");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <form
        onSubmit={handleAdd}
        className={styles.row}
        style={{ marginBottom: 16, justifyContent: "flex-start" }}
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nama kategori baru (mis. Minuman)"
          className={styles.input}
          style={{ maxWidth: 320 }}
          aria-label="Nama kategori baru"
        />
        <button type="submit" className={styles.btn} disabled={adding || !newName.trim()}>
          {adding ? "Menambah…" : "+ Tambah kategori"}
        </button>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Slug</th>
              <th>Produk</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const inUse = c.product_count > 0;
              const isEditing = editingId === c.id;
              return (
                <tr key={c.id}>
                  <td>
                    {isEditing ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={styles.input}
                        style={{ maxWidth: 220 }}
                        aria-label="Nama kategori"
                        autoFocus
                      />
                    ) : (
                      <strong>{c.name}</strong>
                    )}
                  </td>
                  <td className={styles.hint}>{c.slug}</td>
                  <td>{c.product_count}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, whiteSpace: "nowrap" }}>
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className={styles.btn}
                            style={{ padding: "6px 12px", fontSize: 13 }}
                            disabled={busyId === c.id}
                            onClick={() => handleSaveEdit(c.id)}
                          >
                            Simpan
                          </button>
                          <button
                            type="button"
                            className={styles.btnGhost}
                            style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13 }}
                            onClick={() => setEditingId(null)}
                          >
                            Batal
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={styles.btnGhost}
                            style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13 }}
                            onClick={() => {
                              setEditingId(c.id);
                              setEditName(c.name);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={styles.btnDanger}
                            style={{ padding: "6px 12px" }}
                            disabled={busyId === c.id || inUse}
                            title={
                              inUse
                                ? "Masih dipakai produk — pindahkan produk dulu"
                                : "Hapus kategori"
                            }
                            onClick={() => handleDelete(c.id, c.name)}
                          >
                            {busyId === c.id ? "…" : "Hapus"}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
