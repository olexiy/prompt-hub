import { describe, expect, it } from "vitest";
import { isMetaKey, MAX_META_FIELDS, META_VALUE_MAX, metaSchema, orderMeta } from "./meta";

describe("meta fields", () => {
  it("accepts labels in any script and rejects odd keys", () => {
    for (const key of ["description", "Model", "LoRA 1", "Чекпойнт", "seed_2", "v1.5-ref"]) {
      expect(isMetaKey(key), key).toBe(true);
    }
    for (const key of ["", " lead", "-x", "a/b", "<b>", "x".repeat(41), "tab\tkey"]) {
      expect(isMetaKey(key), key).toBe(false);
    }
  });

  it("trims, drops empty values and validates the map", () => {
    expect(metaSchema.parse({ " Model ": " H3 ", note: "  ", description: "x" })).toEqual({
      Model: "H3",
      description: "x",
    });
    expect(metaSchema.safeParse({ "a<b": "x" }).success).toBe(false);
    expect(metaSchema.safeParse({ a: "x".repeat(META_VALUE_MAX + 1) }).success).toBe(false);
    const many = Object.fromEntries(
      Array.from({ length: MAX_META_FIELDS + 1 }, (_, i) => [`k${String(i)}`, "v"]),
    );
    expect(metaSchema.safeParse(many).success).toBe(false);
    expect(metaSchema.safeParse({ a: 1 }).success).toBe(false);
  });

  it("orders built-in fields first, then custom ones alphabetically", () => {
    expect(orderMeta({ Workflow: "w", note: "n", Model: "m", description: "d" })).toEqual([
      ["description", "d"],
      ["note", "n"],
      ["Model", "m"],
      ["Workflow", "w"],
    ]);
  });
});
