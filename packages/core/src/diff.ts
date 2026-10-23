/**
 * Version diff (feature 5): lines are compared with a longest-common-subsequence table, and lines
 * replaced one-for-one get a word-level diff so the changed words stand out. Pure functions, no
 * dependency; prompts are small enough for the O(n·m) table (inputs above the cell limit fall
 * back to "everything changed").
 */

export type DiffLine =
  | { kind: "same"; text: string; oldNo: number; newNo: number }
  | { kind: "del"; text: string; oldNo: number; words?: WordPart[] }
  | { kind: "add"; text: string; newNo: number; words?: WordPart[] };

/** A piece of a changed line; `changed` parts are highlighted. */
export interface WordPart {
  text: string;
  changed: boolean;
}

export interface DiffHunk {
  lines: DiffLine[];
}

const MAX_CELLS = 4_000_000;

/** Indices pairs of a longest common subsequence of `a` and `b`. */
function lcsPairs<T>(a: readonly T[], b: readonly T[]): [number, number][] {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0 || n * m > MAX_CELLS) return [];
  // dp[i][j] = LCS length of a[i..] and b[j..], stored flat.
  const dp = new Uint32Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[at(i, j)] =
        a[i] === b[j]
          ? (dp[at(i + 1, j + 1)] ?? 0) + 1
          : Math.max(dp[at(i + 1, j)] ?? 0, dp[at(i, j + 1)] ?? 0);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if ((dp[at(i + 1, j)] ?? 0) >= (dp[at(i, j + 1)] ?? 0)) i++;
    else j++;
  }
  return pairs;
}

/** Words and the whitespace between them, so joining the parts gives the line back. */
const tokens = (line: string) => line.match(/\s+|[^\s]+/gu) ?? [];

/** Word-level parts of an old and a new line. */
export function diffWords(oldLine: string, newLine: string): { old: WordPart[]; new: WordPart[] } {
  const a = tokens(oldLine);
  const b = tokens(newLine);
  const pairs = lcsPairs(a, b);
  const parts = (side: readonly string[], keep: Set<number>): WordPart[] => {
    const out: WordPart[] = [];
    // Whitespace between two changed words belongs to the change, so it reads as one phrase.
    const isChanged = (i: number) => !keep.has(i);
    side.forEach((text, i) => {
      const changed =
        isChanged(i) ||
        (/^\s+$/u.test(text) &&
          i > 0 &&
          i < side.length - 1 &&
          isChanged(i - 1) &&
          isChanged(i + 1));
      const last = out.at(-1);
      if (last && last.changed === changed) last.text += text;
      else out.push({ text, changed });
    });
    return out;
  };
  return {
    old: parts(a, new Set(pairs.map(([i]) => i))),
    new: parts(b, new Set(pairs.map(([, j]) => j))),
  };
}

/** Every line of both texts, marked same / deleted / added, in reading order. */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const pairs = lcsPairs(a, b);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  const flush = (untilI: number, untilJ: number) => {
    const dels: DiffLine[] = [];
    const adds: DiffLine[] = [];
    for (; i < untilI; i++) dels.push({ kind: "del", text: a[i] ?? "", oldNo: i + 1 });
    for (; j < untilJ; j++) adds.push({ kind: "add", text: b[j] ?? "", newNo: j + 1 });
    // Deleted and added lines are paired in order and get word highlights; extra lines on
    // either side stay whole-line changes.
    dels.forEach((d, k) => {
      const add = adds[k];
      if (!add) return;
      const w = diffWords(d.text, add.text);
      if (d.kind === "del") d.words = w.old;
      if (add.kind === "add") add.words = w.new;
    });
    out.push(...dels, ...adds);
  };
  for (const [pi, pj] of pairs) {
    flush(pi, pj);
    out.push({ kind: "same", text: a[pi] ?? "", oldNo: pi + 1, newNo: pj + 1 });
    i = pi + 1;
    j = pj + 1;
  }
  flush(a.length, b.length);
  return out;
}

/** Changed regions with `context` unchanged lines around them; empty when nothing changed. */
export function diffHunks(oldText: string, newText: string, context = 2): DiffHunk[] {
  const lines = diffLines(oldText, newText);
  const keep = new Set<number>();
  lines.forEach((l, idx) => {
    if (l.kind === "same") return;
    for (let k = Math.max(0, idx - context); k <= Math.min(lines.length - 1, idx + context); k++) {
      keep.add(k);
    }
  });
  const hunks: DiffHunk[] = [];
  let current: DiffLine[] | null = null;
  lines.forEach((l, idx) => {
    if (keep.has(idx)) {
      if (!current) {
        current = [];
        hunks.push({ lines: current });
      }
      current.push(l);
    } else current = null;
  });
  return hunks;
}
