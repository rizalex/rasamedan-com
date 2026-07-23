"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { buildWaLink, getWaNumberAlt } from "@/lib/whatsapp";
import { IconWhatsApp } from "@/components/ui/icons";
import siteInfo from "@/data/site-info.json";
import styles from "./support.module.css";

export default function ContactView() {
  const { t } = useI18n();
  const { contact, shipping } = siteInfo;
  const waLink = buildWaLink(t("support.waGreeting"));
  const waAlt = getWaNumberAlt();
  const csWaLink = buildWaLink(t("support.csGreeting"), waAlt);

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t("support.contactTitle")}</h1>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("support.whatsappLabel")}</h2>
        <p className={styles.value}>{t("support.whatsappNote")}</p>
        <a className={styles.waBtn} href={waLink} target="_blank" rel="noopener noreferrer">
          <IconWhatsApp size={18} />
          {t("common.orderViaWA")}
        </a>
      </div>

      {waAlt && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("support.csWaLabel")}</h2>
          <p className={styles.value}>{t("support.csWaNote")}</p>
          <a className={styles.waBtn} href={csWaLink} target="_blank" rel="noopener noreferrer">
            <IconWhatsApp size={18} />
            {t("common.chatWa")}
          </a>
        </div>
      )}

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("support.addressLabel")}</h2>
        <p className={styles.value}>{contact.address}</p>
        <p className={styles.label}>{t("support.pickupLabel")}</p>
        <p className={styles.value}>{contact.pickupPoint}</p>
        {contact.email && (
          <>
            <p className={styles.label}>{t("support.emailLabel")}</p>
            <p className={styles.value}>{contact.email}</p>
          </>
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("support.hoursLabel")}</h2>
        <ul className={styles.hours}>
          {contact.hours.map((h, i) => (
            <li key={i}>
              <span className={styles.day}>{h.days}</span>
              <span>{h.time}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("support.shippingTitle")}</h2>
        <ul className={styles.shippingList}>
          {shipping.paragraphs.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}
