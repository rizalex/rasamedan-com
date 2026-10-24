"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { CaptchaAction } from "@/lib/captcha-errors";
import styles from "./CaptchaWidget.module.css";

/**
 * Widget Cloudflare Turnstile bersama (login admin, pengaturan akun admin, cek pesanan, checkout).
 * Skill 15 / 21.2 no. 3. Token sekali pakai & berlaku 300 detik → pemanggil WAJIB
 * memanggil `reset()` setelah setiap submit (sukses maupun gagal).
 * Bila `siteKey` kosong (development tanpa captcha) widget tidak dirender.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// Satu loader per halaman (dibuat lazy, hanya di klien — bukan di global scope modul).
let scriptPromise: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null; // izinkan coba lagi
        reject(new Error("turnstile script failed"));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export type CaptchaHandle = { reset: () => void };

export default function CaptchaWidget({
  siteKey,
  action,
  onToken,
  ref,
}: {
  siteKey: string;
  action: CaptchaAction;
  /** Dipanggil dengan token baru, atau "" saat kedaluwarsa/error/reset. */
  onToken: (token: string) => void;
  ref?: Ref<CaptchaHandle>;
}) {
  const { locale } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  // Callback terbaru tanpa me-render ulang widget saat fungsi induk berubah.
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenRef.current("");
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    },
  }));

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          size: "flexible",
          language: locale,
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(""),
          "error-callback": () => onTokenRef.current(""),
        });
      })
      .catch(() => onTokenRef.current(""));
    return () => {
      cancelled = true;
      // Wajib: StrictMode menjalankan effect dua kali → hindari widget ganda.
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, action, locale]);

  if (!siteKey) return null;
  return <div ref={containerRef} className={styles.widget} />;
}
