import { describe, expect, it } from "vitest";
import {
  decodePromptFile,
  isPromptFileName,
  parsePromptFile,
  serializePromptFile,
  type PromptFile,
} from "./promptfile";

const ok = (name: string, text: string) => {
  const r = parsePromptFile(name, text);
  if (!r.ok) throw new Error(`parse failed: ${r.error}`);
  return r.file;
};

describe("prompt files", () => {
  it("accepts .md/.markdown/.txt only", () => {
    expect(["a.md", "B.MD", "x.markdown", "n.txt"].every(isPromptFileName)).toBe(true);
    expect(["a.pdf", "a.md.exe", "txt", "a.json"].some(isPromptFileName)).toBe(false);
  });

  it("decodes strict UTF-8 text and rejects binary or broken encodings", () => {
    const enc = new TextEncoder();
    expect(decodePromptFile(enc.encode("Größe, дождь\n\tok"))).toBe("Größe, дождь\n\tok");
    expect(decodePromptFile(new Uint8Array([0xef, 0xbb, 0xbf, 0x61]))).toBe("a");
    expect(decodePromptFile(new Uint8Array([0xc3, 0x28]))).toBeNull();
    expect(decodePromptFile(enc.encode("a\u0000b"))).toBeNull();
    expect(decodePromptFile(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a]))).toBeNull();
  });

  it("takes the title from front matter, a Markdown heading or the file name", () => {
    expect(ok("x.md", "---\ntitle: Bus stop\n---\nText").title).toBe("Bus stop");
    const heading = ok("x.md", "# Девушка под дождём\n\nТекст {{age}}.");
    expect(heading).toMatchObject({ title: "Девушка под дождём", body: "Текст {{age}}." });
    expect(ok("notes/Brief an Oma.txt", "# not a heading in txt\nLiebe Oma").title).toBe(
      "Brief an Oma",
    );
    expect(ok("C:\\prompts\\len_9s.md", "plain text").title).toBe("len_9s");
  });

  it("reads tags, meta and variables from front matter, block lists and CRLF too", () => {
    const text = [
      "---",
      "title: 'It''s a shot'",
      "tags:",
      "  - video",
      "  - minimax-h3",
      "description: Static medium shot",
      'Model: "MiniMax H3"',
      'variables: [{"name": "age", "default": "25"}]',
      "---",
      "Body {{age}}",
    ].join("\r\n");
    expect(ok("a.md", text)).toEqual({
      title: "It's a shot",
      body: "Body {{age}}",
      tags: ["video", "minimax-h3"],
      variables: [{ name: "age", default: "25" }],
      meta: { description: "Static medium shot", Model: "MiniMax H3" },
    });
  });

  it("reads unquoted YAML flow lists", () => {
    expect(ok("a.md", "---\ntags: [Видео, H3, 'x y']\n---\nb").tags).toEqual([
      "Видео",
      "H3",
      "x y",
    ]);
    expect(ok("a.md", "---\ntags: []\n---\nb").tags).toEqual([]);
  });

  it("reports the line of broken front matter; no closing line means no front matter", () => {
    expect(parsePromptFile("a.md", "---\ntitle: x\ntags: [oops\n---\nb")).toEqual({
      ok: false,
      error: "frontMatter",
      line: 3,
    });
    expect(parsePromptFile("a.md", "---\njust a rule line")).toMatchObject({ ok: true });
  });

  it("round-trips through serializePromptFile", () => {
    const file: PromptFile = {
      title: 'Quote "this": a title',
      body: "---\nNot front matter: {{x}}",
      tags: ["видео", "9s"],
      variables: [{ name: "x", default: "y", description: "d" }],
      meta: { note: "line 1\nline 2", title: "custom key named title" },
    };
    expect(ok("p.md", serializePromptFile(file))).toEqual(file);
  });
});
