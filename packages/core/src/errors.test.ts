import { describe, expect, it } from "vitest";
import { API_ERRORS, errorBody, isApiErrorCode } from "./errors";

describe("API error catalog", () => {
  it("has one code per message and builds bodies", () => {
    const messages = Object.values(API_ERRORS);
    expect(new Set(messages).size).toBe(messages.length);
    expect(errorBody("notFound")).toEqual({ error: "Not found", code: "notFound" });
    expect(isApiErrorCode("notFound")).toBe(true);
    expect(isApiErrorCode("toString")).toBe(false);
    expect(isApiErrorCode(42)).toBe(false);
  });
});
