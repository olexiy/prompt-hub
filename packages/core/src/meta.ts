/**
 * Meta fields of a prompt (feature 27, #52): free key–value pairs stored in `prompt.meta`.
 * `description` and `note` are built in (the app shows them translated, first); any other key is
 * a label the user chose, shown as typed. Values are plain text and never rendered as HTML.
 */
import { z } from "zod";

export const BUILT_IN_META_KEYS = ["description", "note"] as const;
export type BuiltInMetaKey = (typeof BUILT_IN_META_KEYS)[number];

export const META_KEY_MAX = 40;
export const META_VALUE_MAX = 5000;
export const MAX_META_FIELDS = 20;

/** Letters (any script), digits, space, dot, underscore, hyphen; starts with a letter or digit. */
const META_KEY = /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u;

export function isMetaKey(value: string): boolean {
  return value.length <= META_KEY_MAX && META_KEY.test(value) && value === value.trim();
}

/**
 * The whole map, as sent to replace it: keys and values trimmed, empty values dropped (an empty
 * field means "remove it").
 */
export const metaSchema = z
  .record(z.string(), z.string().max(META_VALUE_MAX))
  .transform((m) =>
    Object.fromEntries(
      Object.entries(m)
        .map(([k, v]) => [k.trim(), v.trim()] as const)
        .filter(([, v]) => v !== ""),
    ),
  )
  .refine((m) => Object.keys(m).every(isMetaKey), "Invalid meta field name")
  .refine((m) => Object.keys(m).length <= MAX_META_FIELDS, "Too many meta fields");
export type Meta = Record<string, string>;

/** Display order: the built-in fields first, then the custom ones alphabetically. */
export function orderMeta(meta: Meta): [string, string][] {
  const builtIn = BUILT_IN_META_KEYS.filter((k) => k in meta).map((k) => [k, meta[k] ?? ""]);
  const custom = Object.entries(meta)
    .filter(([k]) => !(BUILT_IN_META_KEYS as readonly string[]).includes(k))
    .sort(([a], [b]) => a.localeCompare(b));
  return [...(builtIn as [string, string][]), ...custom];
}
