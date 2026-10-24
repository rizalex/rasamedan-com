"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import siteInfo from "@/data/site-info.json";
import { fillStoreInfo, storeFaq } from "@/lib/store-faq";
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

      {/* Lokasi & pengiriman (Skill 33, teks SEO yang dipindah dari beranda) */}
      <h2 className={styles.aboutHeading}>{t("support.locationTitle")}</h2>
      <div className={styles.prose}>
        <p>{fillStoreInfo(t("support.locationText"))}</p>
      </div>

      {/* FAQ — isi sama dengan FAQPage JSON-LD di app/tentang/page.tsx */}
      <h2 className={styles.aboutHeading}>{t("support.faqTitle")}</h2>
      <div className={styles.faqList}>
        {storeFaq(t).map((f, i) => (
          <details key={i} className={styles.faqItem}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </main>
  );
}
