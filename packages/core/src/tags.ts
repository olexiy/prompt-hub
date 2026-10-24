/**
 * Tags (topics) on projects and prompts (features 45, 46; #54). Names are the owner's own, in any
 * script: lowercase letters and digits joined by single hyphens, like GitHub topics.
 */
import { z } from "zod";

export const TAG_MAX = 32;
export const MAX_TAGS = 20;

/** Lowercase letters (also scripts without case) and digits, single hyphens in between. */
const TAG_NAME = /^[\p{Ll}\p{Lo}\p{Lm}\p{N}]+(?:-[\p{Ll}\p{Lo}\p{Lm}\p{N}]+)*$/u;

export function isTagName(value: string): boolean {
  return value.length <= TAG_MAX && TAG_NAME.test(value);
}

/** What the user typed → tag name: trimmed, lowercase, spaces and underscores become hyphens. */
export function normalizeTag(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase("und")
    .replace(/[\s_]+/gu, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

/** A full tag set as sent to replace it: normalised, de-duplicated, sorted, validated. */
export const tagsSchema = z
  .array(z.string().max(100))
  .transform((names) => [...new Set(names.map(normalizeTag).filter((n) => n !== ""))].sort())
  .refine((names) => names.every(isTagName), "Invalid tag")
  .refine((names) => names.length <= MAX_TAGS, "Too many tags");
