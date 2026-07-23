"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import StatusBadge, { type OrderStatus } from "@/components/order/StatusBadge";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { IconSearch } from "@/components/ui/icons";
import styles from "./CheckOrderView.module.css";

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

type LookupItem = {
  product_name: string;
  variant: string | null;
  quantity: number;
  unit_price: number;
};
type LookupOrder = {
  order_code: string;
  recipient_name: string;
  fulfillment_method: string;
  status: OrderStatus;
  total_estimate: number | null;
  created_at: string;
  items: LookupItem[];
};

export default function CheckOrderView({
  recaptchaSiteKey,
}: {
  recaptchaSiteKey: string;
}) {
  const { t, locale } = useI18n();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<LookupOrder[] | null>(null);
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
        callback: (tok: string) => setToken(tok),
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
    if (!phone.trim()) {
      setError(t("checkOrder.errPhone"));
      return;
    }
    if (captchaEnabled && !token) {
      setError(t("checkOrder.errCaptcha"));
      return;
    }
    setLoading(true);
    setOrders(null);
    try {
      const qs = new URLSearchParams({ phone: phone.trim() });
      if (code.trim()) qs.set("code", code.trim());
      if (token) qs.set("captcha", token);
      const res = await fetch(`/api/orders?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("checkOrder.errGeneric"));
      } else {
        setOrders(data.orders);
      }
    } catch {
      setError(t("checkOrder.errGeneric"));
    } finally {
      setLoading(false);
      // Token reCAPTCHA v2 sekali pakai — reset agar pencarian berikutnya valid.
      if (captchaEnabled) resetCaptcha();
    }
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t("checkOrder.title")}</h1>
      <p className={styles.subtitle}>{t("checkOrder.subtitle")}</p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <label className={styles.field}>
          <span>{t("checkOrder.phone")} *</span>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08xxxxxxxxxx"
            required
          />
        </label>
        <label className={styles.field}>
          <span>{t("checkOrder.code")}</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ORD-20260707-0001"
          />
        </label>
        {captchaEnabled && (
          <div
            ref={captchaRef}
            className={styles.captcha}
            aria-label="reCAPTCHA"
          />
        )}
        <button type="submit" className={styles.submit} disabled={loading}>
          <IconSearch size={17} />
          {loading ? t("checkOrder.searching") : t("checkOrder.search")}
        </button>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      {orders !== null && (
        <div className={styles.results}>
          {orders.length === 0 ? (
            <p className={styles.noResults}>{t("checkOrder.noResults")}</p>
          ) : (
            <ul className={styles.list}>
              {orders.map((o) => (
                <li key={o.order_code} className={styles.card}>
                  <div className={styles.cardHead}>
                    <div>
                      <p className={styles.code}>{o.order_code}</p>
                      <p className={styles.date}>
                        {formatDateTime(o.created_at, locale)}
                      </p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>

                  <ul className={styles.items}>
                    {o.items.map((it, i) => (
                      <li key={i}>
                        <span>
                          {it.product_name}
                          {it.variant ? ` (${it.variant})` : ""} × {it.quantity}
                        </span>
                        <span>{formatRupiah(it.unit_price * it.quantity)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className={styles.cardFoot}>
                    <span>
                      {o.fulfillment_method === "kurir"
                        ? t("checkout.method_kurir")
                        : t("checkout.method_pickup")}
                    </span>
                    {o.total_estimate != null && (
                      <span className={styles.total}>
                        {t("common.subtotal")}: {formatRupiah(o.total_estimate)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
