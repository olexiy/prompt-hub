import { describe, expect, it } from "vitest";
import { diffHunks, diffLines, diffWords } from "./diff";

describe("diffLines", () => {
  it("marks kept, deleted and added lines with their numbers", () => {
    expect(diffLines("a\nb\nc", "a\nB\nc\nd")).toEqual([
      { kind: "same", text: "a", oldNo: 1, newNo: 1 },
      { kind: "del", text: "b", oldNo: 2, words: [{ text: "b", changed: true }] },
      { kind: "add", text: "B", newNo: 2, words: [{ text: "B", changed: true }] },
      { kind: "same", text: "c", oldNo: 3, newNo: 3 },
      { kind: "add", text: "d", newNo: 4 },
    ]);
  });

  it("identical texts are all 'same'", () => {
    expect(diffLines("x\ny", "x\ny").every((l) => l.kind === "same")).toBe(true);
  });

  it("handles empty texts", () => {
    expect(diffLines("", "new")).toEqual([
      { kind: "del", text: "", oldNo: 1, words: [] },
      { kind: "add", text: "new", newNo: 1, words: [{ text: "new", changed: true }] },
    ]);
  });
});

describe("diffWords", () => {
  it("highlights only changed words, Cyrillic and German included", () => {
    const w = diffWords(
      "камера: лёгкое покачивание, Größe klein",
      "камера: почти статично, Größe groß",
    );
    expect(w.old.filter((p) => p.changed).map((p) => p.text.trim())).toEqual([
      "лёгкое покачивание,",
      "klein",
    ]);
    expect(w.new.filter((p) => p.changed).map((p) => p.text.trim())).toEqual([
      "почти статично,",
      "groß",
    ]);
    expect(w.old.map((p) => p.text).join("")).toBe("камера: лёгкое покачивание, Größe klein");
  });
});

describe("diffHunks", () => {
  it("keeps two lines of context and splits distant changes", () => {
    const old = Array.from({ length: 20 }, (_, i) => `line ${String(i + 1)}`).join("\n");
    const changed = old.replace("line 3", "LINE 3").replace("line 17", "LINE 17");
    const hunks = diffHunks(old, changed);
    expect(hunks).toHaveLength(2);
    expect(hunks[0]?.lines.map((l) => l.text)).toEqual([
      "line 1",
      "line 2",
      "line 3",
      "LINE 3",
      "line 4",
      "line 5",
    ]);
  });

  it("no hunks when nothing changed", () => {
    expect(diffHunks("same", "same")).toEqual([]);
  });
});

describe("pairing", () => {
  it("pairs a replaced line with the first added line when more lines are added", () => {
    const lines = diffLines("weather: {{w}}", "weather: rain\nnew line");
    const del = lines.find((l) => l.kind === "del");
    expect(del?.kind === "del" && del.words?.some((p) => p.changed && p.text === "{{w}}")).toBe(
      true,
    );
    expect(lines.at(-1)).toEqual({ kind: "add", text: "new line", newNo: 2 });
  });
});
