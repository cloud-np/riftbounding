import { describe, expect, it } from "vitest";

import { classifyToken, parseRulesText, rulesSegmentsToPlain } from "../rules-tokens";

describe("parseRulesText", () => {
  it("renders the Accelerate prompt cost as energy + domain icons", () => {
    const segments = parseRulesText(
      "Pay Accelerate [1][Order] as an additional cost to have Azir, Sovereign enter ready?",
    );
    expect(segments.map((s) => s.kind)).toEqual(["text", "energy", "domain", "text"]);
    expect(segments[1]).toEqual({ kind: "energy", amount: 1 });
    expect(segments[2]).toEqual({ kind: "domain", domain: "Order" });
  });

  it("handles catalog text: keywords, runes, might and exhaust (any case)", () => {
    const segments = parseRulesText("[ASSAULT 2] (+2 [Might] while I'm an attacker.)\n[tap]: [add] [rune] [RUNE]");
    expect(segments.filter((s) => s.kind !== "text").map((s) => s.kind)).toEqual([
      "keyword",
      "might",
      "tap",
      "keyword",
      "rune",
      "rune",
    ]);
  });

  it("maps :rb_ codes, strips tags, and leaves unknown tokens as text", () => {
    expect(parseRulesText(":rb_fury: <b>x</b>")).toEqual([
      { kind: "domain", domain: "Fury" },
      { kind: "text", value: " x" },
    ]);
    expect(classifyToken("???")).toBeNull();
    expect(parseRulesText("a [1+2] b")).toEqual([{ kind: "text", value: "a [1+2] b" }]);
  });

  it("is empty for empty input and round-trips to plain words", () => {
    expect(parseRulesText(undefined)).toEqual([]);
    expect(rulesSegmentsToPlain(parseRulesText("Pay [2][Calm]"))).toBe("Pay [2][Calm]");
  });
});
