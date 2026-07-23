"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";

export default function AccountSettingsForm({
  currentUsername,
}: {
  currentUsername: string;
}) {
  const router = useRouter();
  const [newUsername, setNewUsername] = useState(currentUsername);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword) {
      setError("Password saat ini wajib diisi.");
      return;
    }
    // Validasi ringan di client (server tetap validasi ulang).
    if (newPassword && newPassword.length < 8) {
      setError("Password baru minimal 8 karakter.");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError("Konfirmasi password baru tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newUsername,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan perubahan");
        setLoading(false);
        return;
      }

      // Password berubah → sesi lama sudah di-invalidasi server, login ulang.
      if (data.passwordChanged) {
        setSuccess("Password berhasil diubah. Mengarahkan ke halaman login…");
        setTimeout(() => {
          router.push("/admin/login");
          router.refresh();
        }, 1500);
        return;
      }

      // Hanya username berubah → tetap login, segarkan tampilan.
      setSuccess("Perubahan berhasil disimpan.");
      setCurrentPassword("");
      setLoading(false);
      router.refresh();
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <label className={styles.field}>
        <span>Username</span>
        <input
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          autoComplete="username"
        />
      </label>

      <label className={styles.field}>
        <span>Password saat ini (wajib)</span>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      <label className={styles.field}>
        <span>Password baru (kosongkan jika tidak diubah)</span>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
        />
      </label>

      <label className={styles.field}>
        <span>Konfirmasi password baru</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}
      {success && <p className={styles.success}>{success}</p>}

      <button
        type="submit"
        className={styles.btn}
        disabled={loading}
        style={{ justifyContent: "center" }}
      >
        {loading ? "Menyimpan…" : "Simpan Perubahan"}
      </button>
    </form>
  );
}
