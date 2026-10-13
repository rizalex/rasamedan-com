import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { getCaptchaSiteKey } from "@/lib/turnstile";
import LoginForm from "@/components/admin/LoginForm";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  // Sudah login → langsung ke dashboard.
  if (await getAdminSession()) redirect("/admin");

  // Site key dibaca di server saat request (bukan NEXT_PUBLIC) agar bisa diganti
  // saat deploy tanpa build ulang.
  const captchaSiteKey = getCaptchaSiteKey();

  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginCard}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/rasa-medan-mark.svg"
          alt="Rasa Medan"
          className={styles.loginLogo}
        />
        <h1 className={styles.loginTitle}>Rasa Medan — Admin</h1>
        <p className={styles.loginSub}>Masuk untuk mengelola produk & pesanan</p>
        <LoginForm captchaSiteKey={captchaSiteKey} />
      </div>
    </div>
  );
}
