/**
 * URL slugs for handles, projects, folders and prompts (`/{handle}/{project}/{folder}/{prompt}`).
 * Whitelist only: lowercase ASCII letters, digits and single hyphens, 1–64 characters,
 * no leading or trailing hyphen. Anything else is rejected, never "cleaned" on the server.
 */

export const SLUG_MAX_LENGTH = 64;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Path segments the router uses itself; a user, project, folder or prompt cannot take them. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "api",
  "assets",
  "auth",
  "login",
  "logout",
  "settings",
  "new",
  "admin",
  "history",
  "search",
]);

/** True when `value` is a valid slug that is not reserved. */
export function isValidSlug(value: string): boolean {
  return value.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(value) && !RESERVED_SLUGS.has(value);
}

/**
 * Cyrillic → Latin for slug suggestions: Russian and Ukrainian letters, a simple readable scheme
 * ("щ" → "shch", "ю" → "yu", soft and hard signs dropped). Lowercase only; applied after lowercasing.
 */
const CYRILLIC: Readonly<Record<string, string>> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  ґ: "g",
  д: "d",
  е: "e",
  ё: "e",
  є: "ye",
  ж: "zh",
  з: "z",
  и: "i",
  і: "i",
  ї: "yi",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ў: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

/**
 * Suggest a slug from a display name, e.g. "Bus stop – 9 s" → "bus-stop-9-s".
 * Cyrillic is transliterated ("Привет мир" → "privet-mir"), accents are removed ("Größe" → "grosse"),
 * any other letter is dropped; an empty result means the caller asks the user for a slug.
 * Not used for validation.
 */
export function suggestSlug(name: string): string {
  return (
    name
      .toLowerCase()
      // Before NFKD, which would split "й", "ё" and "ї" into a base letter and a combining mark.
      .replace(/[Ѐ-ӿ]/g, (ch) => CYRILLIC[ch] ?? ch)
      .normalize("NFKD")
      .replace(/ß/g, "ss")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, SLUG_MAX_LENGTH)
      .replace(/-+$/, "")
  );
}
