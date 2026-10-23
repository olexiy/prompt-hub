import { describe, expect, it } from "vitest";
import { uuidv7, uuidv7Time } from "./id";

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidv7", () => {
  it("has the v7 layout", () => {
    for (let i = 0; i < 100; i++) expect(uuidv7()).toMatch(UUID_V7);
  });

  it("encodes the timestamp", () => {
    const t = Date.UTC(2026, 9, 23, 12, 0, 0, 123);
    expect(uuidv7Time(uuidv7(t))).toBe(t);
  });

  it("sorts by creation time", () => {
    const ids = [3, 1, 2].map((n) => uuidv7(1_700_000_000_000 + n));
    expect([...ids].sort()).toEqual([ids[1], ids[2], ids[0]]);
  });

  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => uuidv7(0)));
    expect(ids.size).toBe(10_000);
  });
});
