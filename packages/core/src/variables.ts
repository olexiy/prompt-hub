/**
 * `{{variables}}` in prompt bodies (features 14–17, 21, 23): parsing, definitions and rendering.
 * Shared by the API (validation) and the web app (form, preview, copy), so both always agree.
 *
 * Syntax: `{{name}}` or `{{ name }}`. A name is 1–64 Unicode letters, digits, `_` or `-`
 * and starts with a letter, digit or `_` (so `{{тема}}` and `{{Größe}}` work). Anything else
 * between double braces is plain text and stays as written. Rendering is pure string
 * substitution: nothing is evaluated, and `$` patterns in values are inserted literally.
 */
import { z } from "zod";

export const VARIABLE_NAME_MAX = 64;
export const MAX_VARIABLES = 100;
/** Prompt bodies are text for an AI; 100k characters is far above any real prompt. */
export const MAX_PROMPT_BODY = 100_000;
const MAX_DEFAULT = 10_000;
const MAX_DESCRIPTION = 500;

const NAME = String.raw`[\p{L}\p{N}_][\p{L}\p{N}_-]{0,${String(VARIABLE_NAME_MAX - 1)}}`;
const NAME_PATTERN = new RegExp(`^${NAME}$`, "u");
/** New RegExp per use: global regexes carry `lastIndex` state between calls. */
const placeholderPattern = () => new RegExp(String.raw`\{\{\s*(${NAME})\s*\}\}`, "gu");

export function isVariableName(value: string): boolean {
  return NAME_PATTERN.test(value);
}

/** Variable names in order of first use, each once. */
export function parseVariables(body: string): string[] {
  const names = new Set<string>();
  for (const match of body.matchAll(placeholderPattern())) {
    if (match[1]) names.add(match[1]);
  }
  return [...names];
}

export const variableDefSchema = z.strictObject({
  name: z.string().refine(isVariableName, "Invalid variable name"),
  default: z.string().max(MAX_DEFAULT).optional(),
  description: z.string().max(MAX_DESCRIPTION).optional(),
});
export type VariableDef = z.infer<typeof variableDefSchema>;

/** A version's definitions: at most 100, names unique. */
export const variableDefsSchema = z
  .array(variableDefSchema)
  .max(MAX_VARIABLES)
  .refine((defs) => new Set(defs.map((d) => d.name)).size === defs.length, "Duplicate variable");

/** Definitions for every variable in `body`, keeping existing ones and dropping unused ones. */
export function syncDefinitions(body: string, defs: readonly VariableDef[] = []): VariableDef[] {
  const byName = new Map(defs.map((d) => [d.name, d]));
  return parseVariables(body).map((name) => byName.get(name) ?? { name });
}

export interface RenderResult {
  text: string;
  /** Variables with neither a value nor a default; their placeholders stay in `text`. */
  unfilled: string[];
}

/**
 * Fills placeholders: the given value, else the definition's default, else the placeholder
 * stays as written and the name is reported as unfilled. An empty string counts as not given.
 */
export function renderPrompt(
  body: string,
  values: Readonly<Record<string, string | undefined>>,
  defs: readonly VariableDef[] = [],
): RenderResult {
  const defaults = new Map(defs.map((d) => [d.name, d.default]));
  const unfilled = new Set<string>();
  const text = body.replace(placeholderPattern(), (placeholder, name: string) => {
    const value = values[name] || defaults.get(name);
    if (value) return value;
    unfilled.add(name);
    return placeholder;
  });
  return { text, unfilled: [...unfilled] };
}
