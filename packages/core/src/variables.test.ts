import { describe, expect, it } from "vitest";
import {
  isVariableName,
  parseVariables,
  renderPrompt,
  syncDefinitions,
  tokenizePrompt,
  variableDefsSchema,
} from "./variables";

describe("parseVariables", () => {
  it("finds names in order of first use, once each, with optional spaces", () => {
    expect(parseVariables("{{a}} {{ b }} {{a}} {{  c\t}}")).toEqual(["a", "b", "c"]);
  });

  it("accepts Cyrillic, German and other Unicode names", () => {
    expect(parseVariables("Сцена: {{тема}}, Größe {{Größe}}, {{ŝtato_2}}, {{über-art}}")).toEqual([
      "тема",
      "Größe",
      "ŝtato_2",
      "über-art",
    ]);
  });

  it("leaves malformed or invalid placeholders as text", () => {
    expect(parseVariables("{{}} {{ }} {{a b}} {{-x}} {{x.y}} {a} {{{b}}} {{c} }} {{d}")).toEqual([
      "b",
    ]);
  });

  it("limits names to 64 characters", () => {
    expect(parseVariables(`{{${"x".repeat(64)}}}`)).toHaveLength(1);
    expect(parseVariables(`{{${"x".repeat(65)}}}`)).toEqual([]);
  });

  it("isVariableName matches the parser", () => {
    expect(isVariableName("тема")).toBe(true);
    expect(isVariableName("a b")).toBe(false);
    expect(isVariableName("")).toBe(false);
  });
});

describe("renderPrompt", () => {
  it("fills values, then defaults, and keeps unfilled placeholders", () => {
    const result = renderPrompt(
      "Shot of {{subject}} at {{ time }}, {{style}}. Again: {{subject}}.",
      { subject: "a bus stop" },
      [{ name: "time", default: "dusk" }, { name: "style" }],
    );
    expect(result.text).toBe("Shot of a bus stop at dusk, {{style}}. Again: a bus stop.");
    expect(result.unfilled).toEqual(["style"]);
  });

  it("works with Cyrillic and German names and values", () => {
    const result = renderPrompt("Напиши письмо на тему «{{тема}}». Größe: {{Größe}}.", {
      тема: "отпуск в Мюнхене",
      Größe: "groß, ÄÖÜ ß",
    });
    expect(result).toEqual({
      text: "Напиши письмо на тему «отпуск в Мюнхене». Größe: groß, ÄÖÜ ß.",
      unfilled: [],
    });
  });

  it("treats an empty value as not given", () => {
    expect(renderPrompt("{{a}}", { a: "" }, [{ name: "a", default: "d" }]).text).toBe("d");
    expect(renderPrompt("{{a}}", { a: "" }).unfilled).toEqual(["a"]);
  });

  it("inserts values literally: no $-patterns, no recursion, no evaluation", () => {
    const result = renderPrompt("{{a}} {{b}}", { a: "$& $1 $$", b: "{{a}} ${process}" });
    expect(result.text).toBe("$& $1 $$ {{a}} ${process}");
  });

  it("leaves text without placeholders unchanged", () => {
    const body = "No variables here, just {braces} and {{ }}.";
    expect(renderPrompt(body, {})).toEqual({ text: body, unfilled: [] });
  });
});

describe("definitions", () => {
  it("syncDefinitions keeps known ones, adds new ones, drops unused ones", () => {
    expect(
      syncDefinitions("{{b}} {{c}}", [
        { name: "a", default: "x" },
        { name: "b", default: "y", description: "kept" },
      ]),
    ).toEqual([{ name: "b", default: "y", description: "kept" }, { name: "c" }]);
  });

  it("schema rejects duplicates, bad names and unknown fields", () => {
    expect(variableDefsSchema.safeParse([{ name: "тема", default: "x" }]).success).toBe(true);
    expect(variableDefsSchema.safeParse([{ name: "a" }, { name: "a" }]).success).toBe(false);
    expect(variableDefsSchema.safeParse([{ name: "a b" }]).success).toBe(false);
    expect(variableDefsSchema.safeParse([{ name: "a", type: "number" }]).success).toBe(false);
  });
});

describe("tokenizePrompt", () => {
  it("splits text and placeholders and joins back to the body", () => {
    const body = "Hi {{ имя }}, {not} {{x}}{{x}} end";
    const segments = tokenizePrompt(body);
    expect(segments).toEqual([
      { text: "Hi " },
      { variable: "имя", placeholder: "{{ имя }}" },
      { text: ", {not} " },
      { variable: "x", placeholder: "{{x}}" },
      { variable: "x", placeholder: "{{x}}" },
      { text: " end" },
    ]);
    expect(segments.map((s) => ("text" in s ? s.text : s.placeholder)).join("")).toBe(body);
  });

  it("handles empty and placeholder-only bodies", () => {
    expect(tokenizePrompt("")).toEqual([]);
    expect(tokenizePrompt("{{a}}")).toEqual([{ variable: "a", placeholder: "{{a}}" }]);
  });
});
