import { describe, expect, it } from "vitest";
import { scenario } from "./dsl";

describe("scenario fixture", () => {
  it("appends extra catalog cards to a player's Main Deck on request", () => {
    const s = scenario({
      extraCards: { p1: ["Blazing Scorcher"] },
      p1: { hand: ["Blazing Scorcher"] },
    });
    expect(s.handCard("p1", "Blazing Scorcher")).toBeTruthy();
    expect(s.handCard("p2", "Blazing Scorcher")).toBeUndefined();
  });

  it("rejects an unknown card name", () => {
    expect(() => scenario({ extraCards: { p2: ["Not A Real Card"] } })).toThrow(
      /unknown card name/,
    );
  });
});
