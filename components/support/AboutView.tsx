"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import siteInfo from "@/data/site-info.json";
import styles from "./support.module.css";

export default function AboutView() {
  const { t } = useI18n();
  const { about } = siteInfo;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t("support.aboutTitle")}</h1>
      <p className={styles.tagline}>{about.tagline}</p>
      <div className={styles.prose}>
        {about.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </main>
  );
}
