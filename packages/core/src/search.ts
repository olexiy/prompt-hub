/**
 * Full-text search over the user's own prompts (feature 44, #55). The database keeps `tsvector`
 * columns with the `simple` configuration (no stemming, so EN/RU/DE mix freely); a query matches
 * when every word is the start of a word in the title, the live text or a tag.
 */
import type { ProjectSummary } from "./projects";
import { normalizeTag } from "./tags";

export const SEARCH_MAX_WORDS = 8;
export const SEARCH_WORD_MAX = 64;
export const SEARCH_PAGE_SIZE = 20;

/** The words of a query: letters and digits of any script, lowercase, unique, limited. */
export function searchWords(query: string): string[] {
  const words = query
    .normalize("NFC")
    .toLocaleLowerCase("und")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w !== "")
    .map((w) => w.slice(0, SEARCH_WORD_MAX));
  return [...new Set(words)].slice(0, SEARCH_MAX_WORDS);
}

/**
 * `to_tsquery('simple', …)` text: every word as a prefix, all required (`bus:* & stop:*`).
 * Words contain only letters and digits, so no tsquery syntax can be injected. Null when the
 * query has no words.
 */
export function toTsQuery(query: string): string | null {
  const words = searchWords(query);
  return words.length === 0 ? null : words.map((w) => `${w}:*`).join(" & ");
}

/** Tag names a query may mean: the whole query as one topic, and every single word. */
export function searchTagNames(query: string): string[] {
  const whole = normalizeTag(query);
  return [...new Set([whole, ...searchWords(query)].filter((t) => t !== ""))];
}

export interface PromptHit {
  /** Project slug; the owner is the signed-in user. */
  project: string;
  projectName: string;
  /** Folder path inside the project, [] at the root. */
  folder: string[];
  slug: string;
  title: string;
  tags: string[];
  /** Plain-text excerpt of the live version around the matches (no markup). */
  snippet: string;
}

export interface SearchResults {
  query: string;
  page: number;
  projects: ProjectSummary[];
  prompts: PromptHit[];
  /** More prompt hits exist after this page. */
  hasMore: boolean;
}

/** Splits text into plain and matched parts for highlighting: words that start with a query word. */
export function highlightParts(text: string, query: string): { text: string; match: boolean }[] {
  const words = searchWords(query);
  if (words.length === 0) return [{ text, match: false }];
  const parts: { text: string; match: boolean }[] = [];
  for (const token of text.split(/([\p{L}\p{N}]+)/u)) {
    if (token === "") continue;
    const lower = token.toLocaleLowerCase("und");
    const match = /[\p{L}\p{N}]/u.test(token) && words.some((w) => lower.startsWith(w));
    const last = parts.at(-1);
    if (last && last.match === match) last.text += token;
    else parts.push({ text: token, match });
  }
  return parts;
}
