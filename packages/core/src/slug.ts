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
 * Suggest a slug from a display name, e.g. "Bus stop – 9 s" → "bus-stop-9-s".
 * Letters outside a–z are dropped after removing accents, so "Größe" → "grosse" and
 * "Привет" → "" (the caller then asks the user for a slug). Not used for validation.
 */
export function suggestSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/ß/g, "ss")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, "");
}
