"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  getDictionary,
  defaultLocale,
  isLocale,
  type Locale,
  type Dictionary,
} from "@/lib/i18n";

const STORAGE_KEY = "rasa-medan-locale";

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  dict: Dictionary;
  /** Ambil teks lewat key bertitik, mis. t("nav.home"). */
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function resolve(dict: Dictionary, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], dict);
  return typeof value === "string" ? value : key;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Render awal selalu `id` (sama dengan server) untuk hindari hydration mismatch;
  // preferensi tersimpan dibaca setelah mount.
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && isLocale(saved)) setLocaleState(saved);
    } catch {
      /* localStorage tidak tersedia — abaikan */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* abaikan */
    }
  }, []);

  const dict = getDictionary(locale);
  const t = useCallback((key: string) => resolve(dict, key), [dict]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, dict, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n harus dipakai di dalam <I18nProvider>");
  return ctx;
}
