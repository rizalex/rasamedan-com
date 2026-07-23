import type { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import AccountSettingsForm from "@/components/admin/AccountSettingsForm";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

interface AdminRow extends RowDataPacket {
  username: string;
}

export default async function AdminSettingsPage() {
  const session = await getAdminSession();
  // Layout (protected) sudah menjaga, tapi ambil username untuk prefill.
  let currentUsername = "";
  if (session) {
    const [rows] = await pool.query<AdminRow[]>(
      "SELECT username FROM admin_users WHERE id = ? LIMIT 1",
      [session.sub]
    );
    currentUsername = rows[0]?.username ?? "";
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Pengaturan Akun</h1>
      <p className={styles.pageDesc}>
        Ubah username dan/atau password admin. Masukkan password saat ini untuk
        mengonfirmasi setiap perubahan. Setelah password diganti, Anda akan
        diminta login ulang.
      </p>
      <AccountSettingsForm currentUsername={currentUsername} />
    </div>
  );
}
