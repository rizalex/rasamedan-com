"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { IconMapPin, IconArrowUpRight } from "@/components/ui/icons";
import { getStoreInfo } from "@/lib/store";
import styles from "./StoreLocation.module.css";

export default function StoreLocation() {
  const { t } = useI18n();
  const store = getStoreInfo();

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{t("location.title")}</h2>
      <div className={styles.card}>
        <div className={styles.info}>
          <p className={styles.storeName}>{store.name}</p>
          <p className={styles.address}>
            <IconMapPin size={16} />
            <span>{store.address}</span>
          </p>
          {store.mapsLinkUrl && (
            <a
              href={store.mapsLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.mapsBtn}
            >
              <IconMapPin size={16} />
              {t("location.openMaps")}
              <IconArrowUpRight size={14} />
            </a>
          )}
        </div>
        <div className={styles.mapWrap}>
          {store.mapsEmbedUrl ? (
            <iframe
              src={store.mapsEmbedUrl}
              title={`${t("location.title")} — ${store.name}`}
              className={styles.map}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : (
            <div className={styles.mapPlaceholder} aria-hidden>
              <IconMapPin size={32} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
