/**
 * Prompts as text files (#56 single import, #57 project zip): a `.md` or `.txt` file whose body
 * is the prompt text, optionally led by front matter between `---` lines.
 *
 * Front matter is a small YAML subset, enough for hand-written files and for our own export:
 * `key: value` lines, where a value is plain text, a "double-quoted" string or a JSON array or
 * object (`tags: ["video", "h3"]`), plus block lists (`tags:` then `- video` lines). Known keys
 * are `title`, `tags`, `variables` and `meta` (a JSON object); any other key with a text value
 * becomes a meta field, so `description: …` or `Model: …` work as written.
 */
import type { Meta } from "./meta";
import type { VariableDef } from "./variables";

export const PROMPT_FILE_EXTENSIONS = [".md", ".markdown", ".txt"] as const;
/** Same as the API's request limit: the text travels in one JSON body. */
export const MAX_PROMPT_FILE_BYTES = 256 * 1024;

export interface PromptFile {
  title: string;
  body: string;
  tags: string[];
  variables: VariableDef[];
  meta: Meta;
}

export type PromptFileResult =
  | { ok: true; file: PromptFile }
  | { ok: false; error: "type" | "size" | "encoding" | "frontMatter"; line?: number };

/** File name without directories and the extension, for a title of last resort. */
function baseName(name: string): string {
  const file = name.split(/[\\/]/).at(-1) ?? name;
  const dot = file.lastIndexOf(".");
  return (dot > 0 ? file.slice(0, dot) : file).trim();
}

export function isPromptFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return PROMPT_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Bytes → text: strict UTF-8 (a BOM is dropped), no NUL or other control characters except
 * tab, line feed and carriage return; null when the bytes are not such text.
 */
export function decodePromptFile(bytes: Uint8Array): string | null {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    return null;
  }
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is checked
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text) ? null : text;
}

function parseValue(raw: string): unknown {
  const value = raw.trim();
  if (value === "") return "";
  // A hand-written flow list without quotes (`[video, H3]`) is YAML but not JSON.
  if (/^\[[^"[\]{}]*\]$/.test(value)) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^'(.*)'$/, "$1"))
      .filter((item) => item !== "");
  }
  if (value.startsWith("[") || value.startsWith("{") || value.startsWith('"')) {
    return JSON.parse(value) as unknown;
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return value;
}

/** Front matter lines → key/value map; throws the 1-based line number of a line it cannot read. */
function parseFrontMatter(lines: string[], firstLine: number): Map<string, unknown> {
  const out = new Map<string, unknown>();
  let listKey: string | null = null;
  lines.forEach((line, i) => {
    const lineNo = firstLine + i;
    if (line.trim() === "" || line.trimStart().startsWith("#")) return;
    const item = /^\s+-\s+(.*)$/.exec(line) ?? /^-\s+(.*)$/.exec(line);
    if (item && listKey !== null) {
      const list = out.get(listKey);
      if (!Array.isArray(list)) throw new Error(String(lineNo));
      try {
        list.push(parseValue(item[1] ?? ""));
      } catch {
        throw new Error(String(lineNo));
      }
      return;
    }
    const pair = /^([^\s:#-][^:]*?)\s*:(?:\s+(.*))?$/.exec(line);
    if (!pair?.[1]) throw new Error(String(lineNo));
    const key = pair[1].trim();
    const raw = pair[2] ?? "";
    if (raw.trim() === "") {
      // `key:` alone starts a block list (or stays empty).
      out.set(key, []);
      listKey = key;
      return;
    }
    listKey = null;
    try {
      out.set(key, parseValue(raw));
    } catch {
      throw new Error(String(lineNo));
    }
  });
  return out;
}

const asStringList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/**
 * Text of a file → prompt fields. Title: front matter `title`, else a leading `# Heading` of a
 * Markdown file (removed from the text), else the file name. Values are not validated here; the
 * API checks them with the same schemas as any other input.
 */
export function parsePromptFile(name: string, text: string): PromptFileResult {
  const normalized = text.replace(/\r\n?/g, "\n");
  let body = normalized;
  const fields = new Map<string, unknown>();
  if (normalized.startsWith("---\n")) {
    const lines = normalized.split("\n");
    const end = lines.findIndex((l, i) => i > 0 && (l === "---" || l === "..."));
    if (end > 0) {
      try {
        for (const [k, v] of parseFrontMatter(lines.slice(1, end), 2)) fields.set(k, v);
      } catch (err) {
        return { ok: false, error: "frontMatter", line: Number((err as Error).message) };
      }
      body = lines.slice(end + 1).join("\n");
    }
  }

  let title = typeof fields.get("title") === "string" ? (fields.get("title") as string) : "";
  if (!title && !name.toLowerCase().endsWith(".txt")) {
    const heading = /^\s*#\s+(.+?)\s*#*\s*(?:\n|$)/.exec(body);
    if (heading?.[1]) {
      title = heading[1];
      body = body.slice(heading[0].length);
    }
  }
  if (!title) title = baseName(name);

  const meta: Meta = {};
  const metaField = fields.get("meta");
  if (metaField && typeof metaField === "object" && !Array.isArray(metaField)) {
    for (const [k, v] of Object.entries(metaField)) if (typeof v === "string") meta[k] = v;
  }
  for (const [k, v] of fields) {
    if (!["title", "tags", "variables", "meta"].includes(k) && typeof v === "string") meta[k] = v;
  }

  const variables = Array.isArray(fields.get("variables"))
    ? (fields.get("variables") as unknown[]).filter(
        (v): v is VariableDef =>
          !!v && typeof v === "object" && typeof (v as { name?: unknown }).name === "string",
      )
    : [];

  return {
    ok: true,
    file: {
      title: title.trim(),
      // Leading blank lines and trailing whitespace are file layout, not prompt text.
      body: body.replace(/^\n+/, "").trimEnd(),
      tags: asStringList(fields.get("tags")),
      variables,
      meta,
    },
  };
}

/** Prompt fields → `.md` text with front matter; `parsePromptFile` reads it back unchanged. */
export function serializePromptFile(file: PromptFile): string {
  const lines = ["---", `title: ${JSON.stringify(file.title)}`];
  if (file.tags.length > 0) lines.push(`tags: ${JSON.stringify(file.tags)}`);
  if (file.variables.length > 0) lines.push(`variables: ${JSON.stringify(file.variables)}`);
  if (Object.keys(file.meta).length > 0) lines.push(`meta: ${JSON.stringify(file.meta)}`);
  lines.push("---", "");
  return `${lines.join("\n")}${file.body}\n`;
}
