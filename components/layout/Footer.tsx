"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  IconWhatsApp,
  IconMapPin,
  IconClock,
  IconInstagram,
  IconTiktok,
  IconFacebook,
} from "@/components/ui/icons";
import { getStoreInfo } from "@/lib/store";
import { buildWaLink, getWaNumber, getWaNumberAlt } from "@/lib/whatsapp";
import styles from "./Footer.module.css";

/** Format nomor WA (628xxx) → +62 8xxx untuk tampilan. */
function formatWaNumber(num: string): string {
  if (!num) return "";
  const withPlus = num.startsWith("62") ? `+${num}` : num;
  return withPlus;
}

export default function Footer() {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const store = getStoreInfo();
  const waLink = buildWaLink(t("home.waGreeting"));
  const waDisplay = formatWaNumber(getWaNumber());
  const waAlt = getWaNumberAlt();
  const csWaLink = buildWaLink(t("support.csGreeting"), waAlt);
  const csWaDisplay = formatWaNumber(waAlt);

  const socials = [
    { href: store.instagram, Icon: IconInstagram, label: "Instagram" },
    { href: store.tiktok, Icon: IconTiktok, label: "TikTok" },
    { href: store.facebook, Icon: IconFacebook, label: "Facebook" },
  ].filter((s) => s.href);

  return (
    <footer className={styles.footer}>
      {/* Ornamen Melayu ringan (motif pucuk rebung) sebagai garis dekoratif. */}
      <div className={styles.ornament} aria-hidden>
        <svg viewBox="0 0 120 12" preserveAspectRatio="none" width="100%" height="12">
          <path
            d="M0 11 Q6 1 12 11 Q18 1 24 11 Q30 1 36 11 Q42 1 48 11 Q54 1 60 11 Q66 1 72 11 Q78 1 84 11 Q90 1 96 11 Q102 1 108 11 Q114 1 120 11"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      <div className={styles.cols}>
        {/* Chat WhatsApp */}
        <div className={styles.col}>
          <h3 className={styles.colTitle}>
            <IconWhatsApp size={16} />
            {t("common.chatWa")}
          </h3>
          {waDisplay && (
            <div className={styles.waRow}>
              <span className={styles.waLabel}>{t("footer.waOrderLabel")}</span>
              <a href={waLink} target="_blank" rel="noopener noreferrer" className={styles.link}>
                {waDisplay}
              </a>
            </div>
          )}
          {csWaDisplay && (
            <div className={styles.waRow}>
              <span className={styles.waLabel}>{t("footer.waCsLabel")}</span>
              <a href={csWaLink} target="_blank" rel="noopener noreferrer" className={styles.link}>
                {csWaDisplay}
              </a>
            </div>
          )}
        </div>

        {/* Lokasi Toko */}
        <div className={styles.col}>
          <h3 className={styles.colTitle}>
            <IconMapPin size={16} />
            {t("nav.locations")}
          </h3>
          <p className={styles.value}>{store.address}</p>
        </div>

        {/* Jam Operasional */}
        <div className={styles.col}>
          <h3 className={styles.colTitle}>
            <IconClock size={16} />
            {t("footer.hoursTitle")}
          </h3>
          {store.hoursWeekday && <p className={styles.value}>{store.hoursWeekday}</p>}
          {store.hoursWeekend && <p className={styles.value}>{store.hoursWeekend}</p>}
        </div>

        {/* Ikuti Kami */}
        {socials.length > 0 && (
          <div className={styles.col}>
            <h3 className={styles.colTitle}>{t("footer.followTitle")}</h3>
            <div className={styles.socials}>
              {socials.map(({ href, Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className={styles.social}
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <nav className={styles.links}>
        <Link href="/produk">{t("nav.catalog")}</Link>
        <Link href="/cek-pesanan">{t("nav.checkOrder")}</Link>
        <Link href="/tentang">{t("nav.about")}</Link>
        <Link href="/kontak">{t("nav.contact")}</Link>
      </nav>

      <p className={styles.copy}>
        © {year} {t("common.brand")} · {t("common.tagline")}
      </p>
    </footer>
  );
}
