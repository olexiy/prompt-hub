/**
 * User preferences shared by the API (validation) and the web app (UI). The database checks
 * the same values (`app_user_locale_check`, `app_user_theme_check`).
 */

/** UI languages; English is the fallback for everything. */
export const LOCALES = ["en", "ru", "de"] as const;
export type Locale = (typeof LOCALES)[number];

/** "system" follows the operating system's light/dark setting. */
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** Best match for a browser language list (e.g. navigator.languages), English otherwise. */
export function pickLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return "en";
}
