import { describe, expect, it } from "vitest";

import {
  EN_SENTENCES,
  SENTENCE_DESCRIPTORS,
  createGameLogLocalizer,
  formatGameLogText,
  gameLogSegmentsToString,
  parseGameLogText,
  renderGameLogEntry,
  renderGameLogText,
} from "./index";

describe("sentence descriptor table", () => {
  it("covers every original sentence key in evaluation order", () => {
    const ids = SENTENCE_DESCRIPTORS.map((descriptor) => descriptor.id);
    expect(ids).toHaveLength(188);
    expect(new Set(ids)).toEqual(
      new Set([...Object.keys(EN_SENTENCES), "runeBatch", "payment", "rolls"]),
    );
    expect(ids[0]).toBe("closedDeckPeek");
    expect(ids[28]).toBe("rolledD20");
    expect(ids[29]).toBe("rolledDie");
    expect(ids[68]).toBe("runeBatch");
    expect(ids[69]).toBe("payment");
    expect(ids[ids.length - 1]).toBe("performedCardActivity");
  });

  it("recognizes every EN literal verbatim", () => {
    for (const [id, value] of Object.entries(EN_SENTENCES)) {
      if (typeof value !== "string") continue;
      expect(parseGameLogText(value)?.key, `${id}: ${value}`).toBe(`sentence.${id}`);
    }
  });
});

describe("game log parsing", () => {
  it("matches literals exactly", () => {
    expect(parseGameLogText("Shuffled their deck.")).toEqual({
      key: "sentence.shuffledDeck",
      params: {},
      selects: undefined,
    });
    expect(parseGameLogText("Closed deck peek.")?.key).toBe("sentence.closedDeckPeek");
    expect(parseGameLogText("shuffled their deck.")).toBeNull();
  });

  it("parses pattern sentences with counts and selects", () => {
    expect(parseGameLogText("drew 3 cards.")).toEqual({
      key: "sentence.drewCards",
      params: { count: 3 },
      selects: undefined,
    });
    expect(parseGameLogText("drew 1 card.")?.params.count).toBe(1);
    expect(parseGameLogText("revealed a looked-at deck card.")?.params.visibility).toBe("revealed");
    expect(parseGameLogText("moved 4 card(s) from deck to hand.")).toEqual({
      key: "sentence.movedCardsFromDeck",
      params: { count: 4, zone: "hand" },
      selects: undefined,
    });
    expect(parseGameLogText("rolled a d20: 17.")?.params).toEqual({ sides: 20, result: 17 });
    expect(parseGameLogText("conceded the match. Kai wins the match.")?.params).toEqual({
      actor: "author",
      departure: "concededMatch",
      winner: "Kai",
    });
    expect(parseGameLogText("A player left the game and was eliminated.")?.params).toEqual({
      actor: "anonymous",
      departure: "left",
    });
    expect(parseGameLogText("not a real sentence")).toBeNull();
  });

  it("parses rune batches with merging", () => {
    const parsed = parseGameLogText("channeled 2 fury runes and readied 1 rune.");
    expect(parsed?.key).toBe("sentence.runeBatch");
    expect(parsed?.params.clauses).toEqual([
      { action: "channel", runes: { count: 2, domain: "fury" } },
      { action: "ready", runes: { count: 1, domain: null } },
    ]);
    expect(parseGameLogText("channeled 1 rune and 2 runes.")?.params.clauses).toEqual([
      {
        action: "channel",
        runes: [
          { count: 1, domain: null },
          { count: 2, domain: null },
        ],
      },
    ]);
    expect(parseGameLogText("recycled 2 fury runes to float 3 energy.")?.params.clauses).toEqual([
      { action: "recycleFloat", runes: { count: 2, domain: "fury" }, energy: 3 },
    ]);
    expect(parseGameLogText("channeled 1 rune.")?.params.clauses).toEqual([
      { action: "channel", runes: { count: 1, domain: null } },
    ]);
  });

  it("parses payments and details", () => {
    const parsed = parseGameLogText("Auto-paid 3E / 1P — Exhaust 2 · Recycle 1 Fury Rune (+1E).");
    expect(parsed?.key).toBe("sentence.payment");
    expect(parsed?.params.auto).toBe("yes");
    expect(parsed?.params.resources).toEqual({ energy: 3, power: 1, form: "compact" });
    expect(parsed?.params.details).toEqual([
      { kind: "exhaust", count: 2 },
      { kind: "recycle", source: { count: 1, domain: "fury" }, energy: 1 },
    ]);
    expect(parseGameLogText("paid 2 energy.")?.params.resources).toEqual({
      energy: 2,
      power: null,
      form: "spelled",
    });
  });

  it("parses rolls", () => {
    const rolls = parseGameLogText("Team 1 rolled 17. Team 2 rolled 3.")?.params.rolls as Array<{
      competitor: string;
      roll: number;
    }>;
    expect(rolls.map((roll) => ({ competitor: roll.competitor.trim(), roll: roll.roll }))).toEqual([
      { competitor: "Team 1", roll: 17 },
      { competitor: "Team 2", roll: 3 },
    ]);
  });
});

describe("game log localization", () => {
  it("renders French sentences with plurals", () => {
    expect(formatGameLogText("drew 3 cards.", "fr")).toBe("A pioché 3 cartes.");
    expect(formatGameLogText("drew 1 card.", "fr")).toBe("A pioché 1 carte.");
    expect(formatGameLogText("Shuffled their deck.", "fr")).toBe("A mélangé son deck.");
    expect(formatGameLogText("conquered Battlefield A and scored 2.", "fr")).toBe(
      "A conquis le champ de bataille A et marqué 2 points.",
    );
    expect(formatGameLogText("played Bird token to Base.", "fr")).toBe(
      "A joué une création Bird sur la base.",
    );
    expect(formatGameLogText("rolled a d20: 17.", "fr")).toBe("A lancé un d20 : 17.");
    expect(formatGameLogText("Team 1 rolled 17. Team 2 rolled 3.", "fr")).toBe(
      "Équipe 1 a obtenu 17. Équipe 2 a obtenu 3.",
    );
  });

  it("renders rune batches", () => {
    const marked = formatGameLogText("channeled 2 fury runes.", "fr");
    expect(marked).toContain("A canalisé");
    const segments = renderGameLogText("channeled 2 fury runes.", "fr");
    expect(segments).toEqual([
      { type: "text", value: "A canalisé " },
      { type: "rune", count: 2, domain: "fury", before: "2 ", after: "runes de fureur" },
      { type: "text", value: "." },
    ]);
    expect(gameLogSegmentsToString(segments)).toBe("A canalisé 2 runes de fureur.");
  });

  it("renders payments with resources and details", () => {
    const segments = renderGameLogText(
      "paid 3E / 1P — Exhaust 2 · Recycle 1 Fury Rune (+1E).",
      "fr",
    );
    expect(segments[0]).toEqual({
      type: "text",
      value: "A payé ",
    });
    const resource = segments.find((segment) => segment.type === "resource");
    expect(resource).toMatchObject({
      type: "resource",
      kind: "both",
      energy: 3,
      power: 1,
      form: "compact",
      floating: false,
    });
    expect(gameLogSegmentsToString(segments)).toContain("recyclage de 1 rune de fureur");
  });

  it("renders card segments for catalog cards", () => {
    const segments = renderGameLogText("exhausted Blazing Scorcher.", "fr");
    expect(segments).toEqual([
      { type: "text", value: "A épuisé " },
      { type: "card", cardCode: "OGN-001", value: "Blazing Scorcher" },
      { type: "text", value: "." },
    ]);
  });

  it("renders zh-CN and ko sentences", () => {
    expect(formatGameLogText("drew 3 cards.", "zh-CN")).toBe("抽了 3 张卡牌。");
    expect(formatGameLogText("conquered Battlefield A.", "zh-CN")).toBe("征服了战场 A。");
    expect(formatGameLogText("drew 3 cards.", "ko")).toContain("3");
    const zhSegments = renderGameLogText("channeled 2 fury runes.", "zh-CN");
    expect(zhSegments.some((segment) => segment.type === "rune" && segment.count === 2 && segment.domain === "fury")).toBe(true);
    expect(gameLogSegmentsToString(zhSegments)).toContain("符文");
    const koPayment = renderGameLogText("paid 2 energy.", "ko");
    expect(koPayment.some((segment) => segment.type === "resource" && segment.kind === "energy" && segment.energy === 2)).toBe(true);
    const zhErrata = renderGameLogText("exhausted Blazing Scorcher.", "zh-CN");
    expect(zhErrata.some((segment) => segment.type === "card" && segment.cardCode === "OGN-001")).toBe(true);
  });

  it("returns EN text verbatim", () => {
    expect(renderGameLogText("drew 3 cards.", "en")).toEqual([
      { type: "text", value: "drew 3 cards." },
    ]);
    expect(renderGameLogText("drew 3 cards.", null)).toEqual([
      { type: "text", value: "drew 3 cards." },
    ]);
  });

  it("falls back to the trimmed text for unknown lines", () => {
    expect(renderGameLogText("some custom line", "fr")).toEqual([
      { type: "text", value: "some custom line" },
    ]);
  });

  it("builds the original localizer function", () => {
    const localize = createGameLogLocalizer("fr");
    expect(localize("drew 1 card.")).toBe("A pioché 1 carte.");
    expect(localize("  Shuffled their deck.  ")).toBe("A mélangé son deck.");
    expect(localize("unknown")).toBe("unknown");
    const identity = createGameLogLocalizer("en");
    expect(identity("  drew 1 card.  ")).toBe("drew 1 card.");
  });

  it("renders log entries", () => {
    expect(renderGameLogEntry({ text: "drew 2 cards." }, "fr")).toEqual([
      { type: "text", value: "A pioché 2 cartes." },
    ]);
  });
});
