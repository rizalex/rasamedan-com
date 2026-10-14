"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import StatusBadge, { type OrderStatus } from "@/components/order/StatusBadge";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { IconSearch } from "@/components/ui/icons";
import CaptchaWidget, { type CaptchaHandle } from "@/components/security/CaptchaWidget";
import { captchaErrorKey } from "@/lib/captcha-errors";
import styles from "./CheckOrderView.module.css";

type LookupItem = {
  product_name: string;
  variant: string | null;
  quantity: number;
  unit_price: number;
};
type LookupShipment = {
  courier_code: string | null;
  courier_name: string | null;
  waybill: string;
  track_url: string | null;
};
type LookupOrder = {
  order_code: string;
  recipient_name: string;
  fulfillment_method: string;
  status: OrderStatus;
  total_estimate: number | null;
  created_at: string;
  /** Resi & tautan lacak — hanya dikirim server bila dicari dengan Order ID. */
  shipment: LookupShipment | null;
  items: LookupItem[];
};

/** Resi + tombol salin + tautan lacak resmi kurir (Skill 22, jalur cadangan). */
function ShipmentInfo({ shipment }: { shipment: LookupShipment }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const courier =
    shipment.courier_code === "lainnya" || !shipment.courier_name
      ? t("checkOrder.otherCourier")
      : shipment.courier_name;

  async function copy() {
    try {
      await navigator.clipboard.writeText(shipment.waybill);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard tidak tersedia — resi tetap terlihat untuk disalin manual */
    }
  }

  return (
    <div className={styles.shipment}>
      <p className={styles.shipmentTitle}>{t("checkOrder.shipment")}</p>
      <p className={styles.shipmentLine}>
        <span>{courier}</span>
        <span>
          {t("checkOrder.waybill")}: <strong className={styles.waybill}>{shipment.waybill}</strong>
        </span>
        <button type="button" className={styles.copyBtn} onClick={copy}>
          {copied ? t("checkOrder.copied") : t("checkOrder.copy")}
        </button>
      </p>
      {shipment.track_url && (
        <p className={styles.shipmentLine}>
          <a href={shipment.track_url} target="_blank" rel="noopener noreferrer">
            {t("checkOrder.trackOnCourier")} ↗
          </a>
          <span className={styles.shipmentHint}>{t("checkOrder.trackHint")}</span>
        </p>
      )}
    </div>
  );
}

export default function CheckOrderView({ captchaSiteKey }: { captchaSiteKey: string }) {
  const { t, locale } = useI18n();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<LookupOrder[] | null>(null);
  // Apakah pencarian TERAKHIR memakai Order ID (bukan isi kolom saat ini).
  const [searchedWithCode, setSearchedWithCode] = useState(false);
  const [token, setToken] = useState("");

  const captcha = useRef<CaptchaHandle>(null);
  const captchaEnabled = !!captchaSiteKey;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!phone.trim()) {
      setError(t("checkOrder.errPhone"));
      return;
    }
    if (captchaEnabled && !token) {
      setError(t("captcha.required"));
      return;
    }
    setLoading(true);
    setOrders(null);
    try {
      // POST: nomor HP & token tidak masuk URL/riwayat browser/log (Skill 21).
      const res = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim(), captchaToken: token }),
      });
      const data = await res.json();
      if (!res.ok) {
        const key = captchaErrorKey(data.code);
        setError(key ? t(key) : data.error ?? t("checkOrder.errGeneric"));
      } else {
        setSearchedWithCode(!!code.trim());
        setOrders(data.orders);
      }
    } catch {
      setError(t("checkOrder.errGeneric"));
    } finally {
      setLoading(false);
      // Token Turnstile sekali pakai — reset agar pencarian berikutnya valid.
      captcha.current?.reset();
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
        <CaptchaWidget
          ref={captcha}
          siteKey={captchaSiteKey}
          action="check-order"
          onToken={setToken}
        />
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
              {orders.map((o, i) => (
                // Indeks: Order ID bisa tersamar (sama untuk dua pesanan di hari yang sama).
                <li key={i} className={styles.card}>
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

                  {o.shipment ? (
                    <ShipmentInfo shipment={o.shipment} />
                  ) : (
                    // Petunjuk dari status yang memang sudah terlihat — server tidak
                    // memberi tahu apakah resi ada tanpa Order ID.
                    o.fulfillment_method === "kurir" &&
                    !searchedWithCode &&
                    (o.status === "Dikirim" || o.status === "Selesai") && (
                      <p className={styles.shipmentHint}>{t("checkOrder.waybillNeedsCode")}</p>
                    )
                  )}

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
