import { describe, expect, it } from "vitest";
import { isLocale, isTheme, pickLocale } from "./prefs";

describe("prefs", () => {
  it("accepts only known locales and themes", () => {
    expect(isLocale("ru")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(1)).toBe(false);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("auto")).toBe(false);
  });

  it("picks the first supported browser language", () => {
    expect(pickLocale(["fr-FR", "de-AT", "en"])).toBe("de");
    expect(pickLocale(["RU"])).toBe("ru");
    expect(pickLocale(["uk-UA"])).toBe("en");
    expect(pickLocale([])).toBe("en");
  });
});
