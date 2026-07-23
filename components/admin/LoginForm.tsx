"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";

// Minimal typing untuk API grecaptcha yang dipakai.
declare global {
  interface Window {
    grecaptcha?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => number;
      reset: (id?: number) => void;
      getResponse: (id?: number) => string;
    };
  }
}

const SCRIPT_SRC = "https://www.google.com/recaptcha/api.js?render=explicit";

export default function LoginForm({
  recaptchaSiteKey,
}: {
  recaptchaSiteKey: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");

  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const captchaEnabled = !!recaptchaSiteKey;

  // Muat script Google & render widget (explicit render agar tidak balapan dgn React).
  useEffect(() => {
    if (!captchaEnabled) return;
    let cancelled = false;

    function tryRender() {
      if (cancelled || widgetId.current !== null) return;
      if (!window.grecaptcha?.render || !captchaRef.current) return;
      widgetId.current = window.grecaptcha.render(captchaRef.current, {
        sitekey: recaptchaSiteKey,
        callback: (t: string) => setToken(t),
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken(""),
      });
    }

    if (
      !document.querySelector(
        'script[src^="https://www.google.com/recaptcha/api.js"]'
      )
    ) {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }

    const iv = setInterval(() => {
      if (window.grecaptcha?.render) {
        tryRender();
        if (widgetId.current !== null) clearInterval(iv);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [captchaEnabled, recaptchaSiteKey]);

  function resetCaptcha() {
    setToken("");
    if (widgetId.current !== null && window.grecaptcha) {
      window.grecaptcha.reset(widgetId.current);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (captchaEnabled && !token) {
      setError("Mohon centang reCAPTCHA terlebih dahulu.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, recaptchaToken: token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal masuk");
        resetCaptcha();
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
      resetCaptcha();
      setLoading(false);
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

      {captchaEnabled && (
        <div ref={captchaRef} className={styles.captcha} aria-label="reCAPTCHA" />
      )}

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
