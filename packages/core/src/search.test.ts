import { describe, expect, it } from "vitest";
import { highlightParts, searchTagNames, searchWords, toTsQuery } from "./search";

describe("search queries", () => {
  it("keeps letters and digits of any script as lowercase words", () => {
    expect(searchWords("Bus-Stop, 9s!")).toEqual(["bus", "stop", "9s"]);
    expect(searchWords("Девушка под ДОЖДЁМ")).toEqual(["девушка", "под", "дождём"]);
    expect(searchWords("Größe größe")).toEqual(["größe"]);
    expect(searchWords("  ' & | ! :* ( ) ")).toEqual([]);
  });

  it("builds a prefix tsquery that cannot inject syntax", () => {
    expect(toTsQuery("bus stop")).toBe("bus:* & stop:*");
    expect(toTsQuery("a' | b:*")).toBe("a:* & b:*");
    expect(toTsQuery("!!!")).toBeNull();
    expect(toTsQuery("a b c d e f g h i j")?.split("&")).toHaveLength(8);
  });

  it("derives candidate tag names", () => {
    expect(searchTagNames("MiniMax H3")).toEqual(["minimax-h3", "minimax", "h3"]);
    expect(searchTagNames("видео")).toEqual(["видео"]);
  });

  it("highlights words that start with a query word", () => {
    expect(highlightParts("The bus stops at Busan.", "bus")).toEqual([
      { text: "The ", match: false },
      { text: "bus", match: true },
      { text: " stops at ", match: false },
      { text: "Busan", match: true },
      { text: ".", match: false },
    ]);
    expect(highlightParts("Девушка под дождём", "дожд")).toEqual([
      { text: "Девушка под ", match: false },
      { text: "дождём", match: true },
    ]);
  });
});
