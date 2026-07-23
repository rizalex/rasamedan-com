"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useCart } from "@/components/cart/CartProvider";
import { formatRupiah, formatWeight } from "@/lib/format";
import { buildWaLink } from "@/lib/whatsapp";
import { formatOrderMessage, type FulfillmentMethod, type OrderConfirmation } from "@/lib/orders";
import { IconWhatsApp, IconCheck } from "@/components/ui/icons";
import styles from "./CheckoutView.module.css";

export default function CheckoutView() {
  const { t } = useI18n();
  const { items, hydrated, subtotal, totalWeight, clear } = useCart();

  const [method, setMethod] = useState<FulfillmentMethod>("kurir");
  const [form, setForm] = useState({
    recipient_name: "",
    phone: "",
    address: "",
    city: "",
    location_note: "",
    note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ order: OrderConfirmation; waLink: string } | null>(
    null
  );

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validasi client ringan (server tetap sumber kebenaran).
    if (!form.recipient_name.trim() || !form.phone.trim()) {
      setError(t("checkout.errRequired"));
      return;
    }
    if (method === "kurir" && (!form.address.trim() || !form.city.trim())) {
      setError(t("checkout.errAddress"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillment_method: method,
          recipient_name: form.recipient_name,
          phone: form.phone,
          address: method === "kurir" ? form.address : null,
          city: method === "kurir" ? form.city : null,
          location_note: method === "kurir" ? form.location_note : null,
          note: form.note,
          items: items.map((it) => ({
            productId: it.productId,
            variant: it.variant,
            quantity: it.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("checkout.errGeneric"));
        setSubmitting(false);
        return;
      }

      const order: OrderConfirmation = {
        order_code: data.order_code,
        fulfillment_method: method,
        recipient_name: form.recipient_name,
        phone: form.phone,
        address: form.address,
        city: form.city,
        location_note: form.location_note,
        note: form.note,
        items: data.items,
        total_estimate: data.total_estimate,
      };
      const waLink = buildWaLink(formatOrderMessage(order));

      // Data sudah tersimpan di DB (respons OK) SEBELUM membuka WhatsApp.
      clear();
      setSuccess({ order, waLink });
      // Coba buka WhatsApp otomatis (best-effort; tombol manual tetap tersedia).
      window.open(waLink, "_blank", "noopener");
    } catch {
      setError(t("checkout.errGeneric"));
      setSubmitting(false);
    }
  }

  if (!hydrated) return <main className={styles.page} aria-busy="true" />;

  // Sukses
  if (success) {
    return (
      <main className={styles.page}>
        <div className={styles.success}>
          <span className={styles.successIcon} aria-hidden>
            <IconCheck size={26} />
          </span>
          <h1 className={styles.successTitle}>{t("checkout.successTitle")}</h1>
          <p className={styles.successMsg}>{t("checkout.successMsg")}</p>
          <p className={styles.orderId}>
            {t("checkout.orderId")}: <strong>{success.order.order_code}</strong>
          </p>
          <a
            className={styles.waBtn}
            href={success.waLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconWhatsApp size={18} />
            {t("checkout.continueWa")}
          </a>
          <Link href="/cek-pesanan" className={styles.linkAlt}>
            {t("checkout.checkStatus")}
          </Link>
        </div>
      </main>
    );
  }

  // Keranjang kosong
  if (items.length === 0) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>{t("checkout.title")}</h1>
        <div className={styles.empty}>
          <p>{t("cart.empty")}</p>
          <Link href="/produk" className={styles.emptyCta}>
            {t("cart.emptyCta")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t("checkout.title")}</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Metode pengambilan */}
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{t("checkout.method")}</legend>
          <div className={styles.methodGrid}>
            {(["kurir", "pickup"] as FulfillmentMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`${styles.methodBtn} ${method === m ? styles.methodActive : ""}`}
                aria-pressed={method === m}
                onClick={() => setMethod(m)}
              >
                {t(`checkout.method_${m}`)}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Data pelanggan */}
        <label className={styles.field}>
          <span>{t("checkout.name")} *</span>
          <input
            value={form.recipient_name}
            onChange={(e) => update("recipient_name", e.target.value)}
            required
          />
        </label>
        <label className={styles.field}>
          <span>{t("checkout.phone")} *</span>
          <input
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            required
          />
        </label>

        {method === "kurir" && (
          <>
            <label className={styles.field}>
              <span>{t("checkout.address")} *</span>
              <textarea
                rows={2}
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                required
              />
            </label>
            <label className={styles.field}>
              <span>{t("checkout.city")} *</span>
              <input
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                required
              />
            </label>
            <label className={styles.field}>
              <span>{t("checkout.locationNote")}</span>
              <input
                value={form.location_note}
                onChange={(e) => update("location_note", e.target.value)}
              />
            </label>
          </>
        )}

        <label className={styles.field}>
          <span>
            {method === "pickup" ? t("checkout.pickupNote") : t("checkout.note")}
          </span>
          <input value={form.note} onChange={(e) => update("note", e.target.value)} />
        </label>

        {/* Ringkasan */}
        <div className={styles.summary}>
          <h2 className={styles.summaryTitle}>{t("checkout.orderSummary")}</h2>
          <ul className={styles.items}>
            {items.map((it) => (
              <li key={`${it.productId}::${it.variant ?? ""}`}>
                <span>
                  {it.name}
                  {it.variant ? ` (${it.variant})` : ""} × {it.quantity}
                </span>
                <span>{formatRupiah(it.price * it.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className={styles.subtotalRow}>
            <span>{t("common.subtotal")}</span>
            <strong>{formatRupiah(subtotal)}</strong>
          </div>
          {totalWeight > 0 && (
            <div className={styles.subtotalRow}>
              <span>{t("common.weightEstimate")}</span>
              <span>{formatWeight(totalWeight)}</span>
            </div>
          )}
          <p className={styles.note}>{t("cart.shippingNote")}</p>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting ? t("checkout.processing") : t("checkout.placeOrder")}
        </button>
      </form>
    </main>
  );
}
