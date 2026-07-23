"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import {
  IconShield,
  IconShoppingBag,
  IconWhatsApp,
  IconTruck,
  IconLock,
} from "@/components/ui/icons";
import styles from "./TrustSection.module.css";

// Konten statis (tidak perlu database, Skill 18) — teks lewat i18n (id/en).
const ITEMS = [
  { Icon: IconShield, titleKey: "trust.halalTitle", descKey: "trust.halalDesc" },
  { Icon: IconShoppingBag, titleKey: "trust.noLoginTitle", descKey: "trust.noLoginDesc" },
  { Icon: IconWhatsApp, titleKey: "trust.waTitle", descKey: "trust.waDesc" },
  { Icon: IconTruck, titleKey: "trust.nextDayTitle", descKey: "trust.nextDayDesc" },
  { Icon: IconLock, titleKey: "trust.secureTitle", descKey: "trust.secureDesc" },
] as const;

export default function TrustSection() {
  const { t } = useI18n();

  return (
    <div className={styles.strip}>
      {ITEMS.map(({ Icon, titleKey, descKey }) => (
        <div key={titleKey} className={styles.item}>
          <span className={styles.icon}>
            <Icon size={24} />
          </span>
          <div className={styles.text}>
            <p className={styles.title}>{t(titleKey)}</p>
            <p className={styles.desc}>{t(descKey)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
