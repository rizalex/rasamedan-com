"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import CaptchaWidget, { type CaptchaHandle } from "@/components/security/CaptchaWidget";
import { captchaErrorKey } from "@/lib/captcha-errors";
import { formatRupiah } from "@/lib/format";
import type { ShippingRate } from "@/lib/orders";
import styles from "./ShippingSection.module.css";

/**
 * Pilihan wilayah tujuan + estimasi ongkir per kurir (Skill 31.6).
 * Provinsi → Kota/Kab → Kecamatan (dimuat bertahap dari /api/shipping/locations),
 * lalu tombol "Lihat ongkir" (eksplisit, agar biaya api.co.id terkendali).
 * Bila data wilayah gagal dimuat → `fallback`: induk kembali ke input teks lama.
 */

type Location = { code: string; name: string };
type Level = "province" | "city" | "district";

export type ShippingState = {
  /** Data wilayah tidak tersedia → pakai input teks kecamatan/kota lama. */
  fallback: boolean;
  districtCode: string | null;
  /** Tarif tampil → pelanggan WAJIB memilih salah satu (keputusan pemilik 31a). */
  mustSelect: boolean;
  selected: ShippingRate | null;
};

export const INITIAL_SHIPPING: ShippingState = {
  fallback: false,
  districtCode: null,
  mustSelect: false,
  selected: null,
};

type CartLine = { productId: number; variant: string | null; quantity: number };

const REASON_KEY: Record<string, string> = {
  WEIGHT_UNKNOWN: "checkout.shipping.weightUnknown",
  TOO_HEAVY: "checkout.shipping.tooHeavy",
  NOT_SERVED: "checkout.shipping.notServed",
  RATE_LIMITED: "checkout.shipping.rateLimited",
};

export default function ShippingSection({
  captchaSiteKey,
  items,
  onChange,
}: {
  captchaSiteKey: string;
  items: CartLine[];
  onChange: (state: ShippingState) => void;
}) {
  const { t } = useI18n();
  const [lists, setLists] = useState<Record<Level, Location[]>>({ province: [], city: [], district: [] });
  const [picked, setPicked] = useState<Record<Level, string>>({ province: "", city: "", district: "" });
  const [loading, setLoading] = useState<Level | null>("province");
  const [rates, setRates] = useState<ShippingRate[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const captcha = useRef<CaptchaHandle>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Laporkan status ke induk setiap kali pilihan berubah.
  useEffect(() => {
    const rate = rates?.find((r) => `${r.courierCode}|${r.serviceCode}` === selected) ?? null;
    onChangeRef.current({
      fallback: false,
      districtCode: picked.district || null,
      mustSelect: !!rates && rates.length > 0,
      selected: rate,
    });
  }, [picked.district, rates, selected]);

  async function load(level: Level, parent: string | null) {
    setLoading(level);
    try {
      const qs = new URLSearchParams({ level, ...(parent ? { parent } : {}) });
      const res = await fetch(`/api/shipping/locations?${qs}`);
      const data = await res.json();
      if (!data.available) {
        // Data wilayah tidak tersedia (termasuk 429) → induk kembali ke input
        // teks kecamatan/kota, agar checkout tidak pernah buntu.
        onChangeRef.current({ ...INITIAL_SHIPPING, fallback: true });
        return;
      }
      setLists((l) => ({ ...l, [level]: data.locations as Location[] }));
    } catch {
      onChangeRef.current({ ...INITIAL_SHIPPING, fallback: true });
    } finally {
      setLoading(null);
    }
  }

  useEffect(() => {
    load("province", null); // sekali saat mount
  }, []);

  // Keranjang berubah → tarif lama tidak berlaku lagi (berat berbeda).
  const itemsKey = items.map((it) => `${it.productId}:${it.variant ?? ""}:${it.quantity}`).join(",");
  useEffect(() => {
    setRates(null);
    setSelected("");
  }, [itemsKey]);

  function pick(level: Level, code: string) {
    setMessage(null);
    setRates(null);
    setSelected("");
    if (level === "province") {
      setPicked({ province: code, city: "", district: "" });
      setLists((l) => ({ ...l, city: [], district: [] }));
      if (code) load("city", code);
    } else if (level === "city") {
      setPicked((p) => ({ ...p, city: code, district: "" }));
      setLists((l) => ({ ...l, district: [] }));
      if (code) load("district", code);
    } else {
      setPicked((p) => ({ ...p, district: code }));
    }
  }

  async function checkRates() {
    setMessage(null);
    if (!picked.district) {
      setMessage(t("checkout.shipping.chooseDistrict"));
      return;
    }
    if (captchaSiteKey && !captchaToken) {
      setMessage(t("captcha.required"));
      return;
    }
    setChecking(true);
    try {
      const res = await fetch("/api/shipping/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ districtCode: picked.district, items, captchaToken }),
      });
      const data = await res.json();
      const capKey = captchaErrorKey(data.code);
      if (capKey) {
        setMessage(t(capKey));
      } else if (data.available) {
        setRates(data.rates as ShippingRate[]);
        setSelected("");
      } else {
        setRates(null);
        setMessage(t(REASON_KEY[data.reason] ?? "checkout.shipping.unavailable"));
      }
    } catch {
      setMessage(t("checkout.shipping.unavailable"));
    } finally {
      captcha.current?.reset(); // token sekali pakai
      setChecking(false);
    }
  }

  const select = (level: Level, label: string, disabled: boolean) => (
    <label className={styles.field}>
      <span>{label} *</span>
      <select
        value={picked[level]}
        onChange={(e) => pick(level, e.target.value)}
        disabled={disabled || loading === level}
        required
      >
        <option value="">{loading === level ? t("checkout.shipping.loading") : t("checkout.shipping.choose")}</option>
        {lists[level].map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className={styles.section}>
      {select("province", t("checkout.shipping.province"), false)}
      {select("city", t("checkout.shipping.city"), !picked.province)}
      {select("district", t("checkout.shipping.district"), !picked.city)}

      {picked.district && (
        <div className={styles.rates}>
          <p className={styles.title}>{t("checkout.shipping.title")}</p>
          {!rates && (
            <>
              <CaptchaWidget
                ref={captcha}
                siteKey={captchaSiteKey}
                action="shipping-rates"
                onToken={setCaptchaToken}
              />
              <button type="button" className={styles.checkBtn} onClick={checkRates} disabled={checking}>
                {checking ? t("checkout.shipping.checking") : t("checkout.shipping.check")}
              </button>
            </>
          )}
          {rates && (
            <div role="radiogroup" aria-label={t("checkout.shipping.title")} className={styles.list}>
              {rates.map((r) => {
                const id = `${r.courierCode}|${r.serviceCode}`;
                return (
                  <label key={id} className={`${styles.option} ${selected === id ? styles.optionActive : ""}`}>
                    <input
                      type="radio"
                      name="shipping-rate"
                      value={id}
                      checked={selected === id}
                      onChange={() => setSelected(id)}
                    />
                    <span className={styles.optionMain}>
                      <strong>
                        {r.courierName} · {r.serviceName}
                      </strong>
                      {r.etd && (
                        <span className={styles.etd}>{t("checkout.shipping.etd").replace("{days}", () => r.etd ?? "")}</span>
                      )}
                    </span>
                    <span className={styles.price}>{formatRupiah(r.price)}</span>
                  </label>
                );
              })}
            </div>
          )}
          {message && <p className={styles.message}>{message}</p>}
          <p className={styles.disclaimer}>{t("checkout.shipping.disclaimer")}</p>
        </div>
      )}
    </div>
  );
}
