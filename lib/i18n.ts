import id from "@/locales/id.json";
import en from "@/locales/en.json";

/**
 * i18n dasar (Skill 1). Menyediakan kamus id/en dan helper akses key.
 * Provider React + toggle bahasa yang persist ditambahkan di Skill 3/10.
 *
 * Keputusan: memakai kamus JSON ringan (bukan next-intl) agar tetap kompatibel
 * dengan deploy cPanel/Passenger tanpa middleware routing (AGENTS.md bag.2).
 */
export const locales = ["id", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "id";

export type Dictionary = typeof id;

const dictionaries: Record<Locale, Dictionary> = { id, en };

export function getDictionary(locale: Locale = defaultLocale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
