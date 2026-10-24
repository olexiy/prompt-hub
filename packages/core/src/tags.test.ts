import { describe, expect, it } from "vitest";
import { isTagName, MAX_TAGS, normalizeTag, tagsSchema } from "./tags";

describe("tags", () => {
  it("accepts lowercase names in any script", () => {
    for (const name of ["comfyui", "minimax-h3", "9s", "видео", "größe", "日本語", "deutsch-2"]) {
      expect(isTagName(name), name).toBe(true);
    }
    for (const name of ["", "Video", "a--b", "-a", "a-", "a b", "a/b", "<b>", "x".repeat(33)]) {
      expect(isTagName(name), name).toBe(false);
    }
  });

  it("normalises what the user typed", () => {
    expect(normalizeTag("  MiniMax H3 ")).toBe("minimax-h3");
    expect(normalizeTag("Software_Entwicklung")).toBe("software-entwicklung");
    expect(normalizeTag("Видео  Клипы")).toBe("видео-клипы");
    expect(normalizeTag("--a--b--")).toBe("a-b");
  });

  it("parses a set: normalised, unique, sorted, limited", () => {
    expect(tagsSchema.parse(["Video", "video", " ComfyUI ", ""])).toEqual(["comfyui", "video"]);
    expect(tagsSchema.safeParse(["a/b"]).success).toBe(false);
    const many = Array.from({ length: MAX_TAGS + 1 }, (_, i) => `t${String(i)}`);
    expect(tagsSchema.safeParse(many).success).toBe(false);
  });
});
