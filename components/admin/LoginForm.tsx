"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import CaptchaWidget, { type CaptchaHandle } from "@/components/security/CaptchaWidget";
import { captchaErrorKey } from "@/lib/captcha-errors";
import styles from "./admin.module.css";

export default function LoginForm({ captchaSiteKey }: { captchaSiteKey: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");
  const captcha = useRef<CaptchaHandle>(null);
  const captchaEnabled = !!captchaSiteKey;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (captchaEnabled && !token) {
      setError(t("captcha.required"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, captchaToken: token }),
      });
      const data = await res.json();
      if (!res.ok) {
        const key = captchaErrorKey(data.code);
        setError(key ? t(key) : data.error ?? "Gagal masuk");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
      setLoading(false);
    } finally {
      // Token Turnstile sekali pakai — reset setelah setiap submit.
      captcha.current?.reset();
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form} style={{ maxWidth: "none" }}>
      <label className={styles.field}>
        <span>Username</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
      </label>
      <label className={styles.field}>
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      <CaptchaWidget ref={captcha} siteKey={captchaSiteKey} action="login" onToken={setToken} />

      {error && <p className={styles.error}>{error}</p>}
      <button
        type="submit"
        className={styles.btn}
        disabled={loading}
        style={{ justifyContent: "center" }}
      >
        {loading ? "Memproses..." : "Masuk"}
      </button>
    </form>
  );
}
