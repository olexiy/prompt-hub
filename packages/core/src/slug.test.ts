import { describe, expect, it } from "vitest";
import { isValidSlug, SLUG_MAX_LENGTH, suggestSlug } from "./slug";

describe("isValidSlug", () => {
  it.each(["comfy-h3", "bus-stop-9s", "a", "v2", "x".repeat(SLUG_MAX_LENGTH)])(
    "accepts %s",
    (s) => {
      expect(isValidSlug(s)).toBe(true);
    },
  );

  it.each([
    ["empty", ""],
    ["uppercase", "Comfy"],
    ["leading hyphen", "-a"],
    ["trailing hyphen", "a-"],
    ["double hyphen", "a--b"],
    ["underscore", "a_b"],
    ["dot (path tricks)", ".."],
    ["slash", "a/b"],
    ["cyrillic", "промпт"],
    ["too long", "x".repeat(SLUG_MAX_LENGTH + 1)],
    ["reserved", "api"],
    ["reserved", "settings"],
  ])("rejects %s: %s", (_, s) => {
    expect(isValidSlug(s)).toBe(false);
  });
});

describe("suggestSlug", () => {
  it.each([
    ["Bus stop – 9 s", "bus-stop-9-s"],
    ["  Comfy H3  ", "comfy-h3"],
    ["Größe & Übung", "grosse-ubung"],
    ["Привет мир", ""],
    ["a".repeat(70) + "-tail", "a".repeat(64)],
  ])("%s → %s", (name, slug) => {
    expect(suggestSlug(name)).toBe(slug);
  });

  it("only produces valid slugs or an empty string", () => {
    for (const name of ["Hello, World!", "x -- y", "2026 Plan", "ñandú"]) {
      const slug = suggestSlug(name);
      expect(slug === "" || isValidSlug(slug)).toBe(true);
    }
  });
});
