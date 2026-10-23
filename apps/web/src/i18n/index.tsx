/**
 * Minimal i18n: three typed catalogs and a context. No library — the app has a few hundred
 * strings at most, and TypeScript guarantees every key exists in every language.
 */
import type { Locale } from "@prompt-hub/core";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { de } from "./de";
import { en, type MessageKey, type Messages } from "./en";
import { ru } from "./ru";

const catalogs: Record<Locale, Messages> = { en, ru, de };

/** Language names in their own language, for the language picker. */
export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
  de: "Deutsch",
};

export type Translate = (key: MessageKey, values?: Record<string, string>) => string;

export function translator(locale: Locale): Translate {
  const messages = catalogs[locale];
  return (key, values) =>
    messages[key].replace(/\{(\w+)\}/g, (match, name: string) => values?.[name] ?? match);
}

const I18nContext = createContext<{ locale: Locale; t: Translate }>({
  locale: "en",
  t: translator("en"),
});

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: translator(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** `const { t, locale } = useI18n()` in any component below the provider. */
export function useI18n() {
  return useContext(I18nContext);
}

export type { MessageKey };
