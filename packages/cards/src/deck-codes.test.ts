import { describe, expect, it } from "vitest";

import {
  canonicalEncodableCardCode,
  decodeDeckCodeToDecklist,
  encodeDecklistToDeckCode,
  getCardById,
  getCodeFromDeck,
  getDeckFromCode,
  normalizeCardCode,
  parseDeckText,
  VarintTranslator,
} from "./index";

describe("VarintTranslator", () => {
  it("round-trips varints", () => {
    for (const value of [0, 1, 127, 128, 300, 16383, 16384, 1_000_000]) {
      const reader = new VarintTranslator(VarintTranslator.GetVarint(value));
      expect(reader.PopVarint()).toBe(value);
    }
    expect(() => new VarintTranslator(new Uint8Array()).PopVarint()).toThrow(
      "No bytes available to read varint",
    );
    expect(() => new VarintTranslator(new Uint8Array([0x80])).PopVarint()).toThrow(
      "Byte array did not contain valid varints.",
    );
  });
});

describe("deck codes", () => {
  it("encodes the minimal v3 deck exactly", () => {
    expect(getCodeFromDeck([{ cardCode: "OGN-001", count: 1 }])).toBe(
      "CMAAAAAAAAAAAAAAAAAACAIAAAAQAAAAAA",
    );
  });

  it("decodes the minimal code", () => {
    expect(getDeckFromCode("CMAAAAAAAAAAAAAAAAAACAIAAAAQAAAAAA")).toEqual({
      mainDeck: [{ cardCode: "OGN-001", count: 1 }],
      sideboard: [],
      chosenChampion: undefined,
      additionalLegends: undefined,
    });
  });

  it("uses v4 for R-prefixed runes and round-trips", () => {
    const code = getCodeFromDeck([{ cardCode: "SFD-R01", count: 1 }]);
    expect(code).toBe("CQAAAAAAAAAAAAAAAAAACAIDAAAQCAAAAAAA");
    expect(getDeckFromCode(code).mainDeck).toEqual([{ cardCode: "SFD-R01", count: 1 }]);
  });

  it("uses v5 for high counts and round-trips", () => {
    const code = getCodeFromDeck([{ cardCode: "OGN-001", count: 13 }]);
    expect(code).toBe("CUAACDIBAEAAAAIAAA");
    expect(getDeckFromCode(code).mainDeck).toEqual([{ cardCode: "OGN-001", count: 13 }]);
  });

  it("uses v6 for additional legends and round-trips", () => {
    const code = getCodeFromDeck([{ cardCode: "OGN-001", count: 1 }], [], undefined, ["OGN-002"]);
    expect(code).toBe("CYAACAIBAEAAAAIAAAAQAAAC");
    expect(getDeckFromCode(code)).toEqual({
      mainDeck: [{ cardCode: "OGN-001", count: 1 }],
      sideboard: [],
      chosenChampion: undefined,
      additionalLegends: ["OGN-002"],
    });
  });

  it("round-trips a full deck with champion, sideboard, runes and variants", () => {
    const main = [
      { cardCode: "OGN-247", count: 1 },
      { cardCode: "OGN-039", count: 1 },
      { cardCode: "OGN-001a", count: 3 },
      { cardCode: "OGN-275", count: 1 },
      { cardCode: "OGN-277", count: 1 },
      { cardCode: "OGN-279", count: 1 },
      { cardCode: "OGN-007", count: 6 },
      { cardCode: "OGN-089", count: 6 },
    ];
    const sideboard = [{ cardCode: "OGN-168", count: 2 }];
    const code = getCodeFromDeck(main, sideboard, "OGN-039");
    expect(code.startsWith("C")).toBe(true);
    const decoded = getDeckFromCode(code);
    const key = (entry: { cardCode?: string; count: number }) => `${entry.cardCode}:${entry.count}`;
    expect(decoded.chosenChampion).toBe("OGN-039");
    expect(decoded.mainDeck.map(key).sort()).toEqual(main.map(key).sort());
    expect(decoded.sideboard.map(key).sort()).toEqual(sideboard.map(key).sort());
  });

  it("throws the original encoding errors", () => {
    expect(() => getCodeFromDeck([{ cardCode: "OGN-001", count: 0 }])).toThrow(
      "Invalid card count for OGN-001: 0. Count must be a positive integer.",
    );
    expect(() => getCodeFromDeck([], [], undefined, [""])).toThrow(
      "Invalid additional legend: . Expected a card code string.",
    );
    expect(() => getCodeFromDeck([{ cardCode: "BOGUS-001", count: 1 }])).toThrow(
      "Unknown set: BOGUS. Valid sets: OGN, OGS, ARC, SFD, UNL, VEN, RAD",
    );
    expect(() => getCodeFromDeck([{ cardCode: "OGN-001c", count: 1 }])).toThrow(
      "Unknown variant: 'c'. Valid variants: , a, s, *, b",
    );
  });

  it("throws the original decoding errors", () => {
    expect(() => getDeckFromCode("0O0O")).toThrow("Invalid character in deck code: '0'");
    expect(() => getDeckFromCode("EE")).toThrow("Unsupported format: 2. Expected format: 1");
    expect(() => getDeckFromCode("C4")).toThrow(
      "Unsupported version: 7. Maximum supported version: 6",
    );
  });

  it("supports a custom signed suffix", () => {
    const code = getCodeFromDeck([{ cardCode: "OGN-001s", count: 1 }]);
    expect(getDeckFromCode(code).mainDeck[0]?.cardCode).toBe("OGN-001s");
    expect(getDeckFromCode(code, { signedSuffix: "t" }).mainDeck[0]?.cardCode).toBe("OGN-001t");
  });

  it("normalizes pasted and catalog codes", () => {
    expect(normalizeCardCode("ogn-001a")).toBe("OGN-001A");
    expect(normalizeCardCode("ogn-001*")).toBe("OGN-001S");
    expect(normalizeCardCode("weird")).toBe("WEIRD");
    expect(canonicalEncodableCardCode("OGN-001P", undefined)).toBe("OGN-001");
    expect(canonicalEncodableCardCode("OGN-001C", "OGN-001")).toBe("OGN-001");
    expect(canonicalEncodableCardCode("OGN-001AS", "OGN-001A")).toBe("OGN-001a");
    expect(canonicalEncodableCardCode("OGN-001B", undefined)).toBe("OGN-001b");
  });

  it("decodes a deck code into decklist sections", () => {
    const main = [
      { cardCode: "OGN-247", count: 1 },
      { cardCode: "OGN-039", count: 1 },
      { cardCode: "OGN-001", count: 3 },
      { cardCode: "OGN-275", count: 1 },
      { cardCode: "OGN-277", count: 1 },
      { cardCode: "OGN-279", count: 1 },
      { cardCode: "OGN-007", count: 6 },
      { cardCode: "OGN-089", count: 6 },
    ];
    const decoded = decodeDeckCodeToDecklist(getCodeFromDeck(main, [], "OGN-039"));
    expect(decoded.warnings).toEqual([]);
    const parsed = parseDeckText(decoded.decklistRaw);
    expect(parsed.sections.legend.map((entry) => entry.cardCode)).toEqual(["OGN-247"]);
    expect(parsed.sections.champion.map((entry) => entry.cardCode)).toEqual(["OGN-039"]);
    expect(parsed.sections.battlefields).toHaveLength(3);
    expect(parsed.sections.runes).toHaveLength(2);
  });

  it("warns when the decoded deck lacks a single legend", () => {
    const decoded = decodeDeckCodeToDecklist(getCodeFromDeck([{ cardCode: "OGN-001", count: 1 }]));
    expect(decoded.warnings).toEqual([
      "The decoded deck does not have a single legend to infer the Champion section from, so pick the champion manually after decoding.",
    ]);
    expect(() => decodeDeckCodeToDecklist("   ")).toThrow("Paste a Riftbound deck code first.");
  });

  it("encodes a parsed decklist back to a code", () => {
    const legend = getCardById("OGN-247");
    const champion = getCardById("OGN-039");
    expect(legend && champion).toBeTruthy();
    const text = [
      "Legend:",
      "1 Kai'Sa, Daughter of the Void [OGN-247]",
      "Champion:",
      "1 Kai'Sa, Survivor [OGN-039]",
      "MainDeck:",
      "3 Blazing Scorcher [OGN-001]",
      "Battlefields:",
      "1 Altar to Unity [OGN-275]",
      "1 Back-Alley Bar [OGN-277]",
      "1 Fortified Position [OGN-279]",
      "Runes:",
      "6 Fury Rune [OGN-007]",
      "6 Mind Rune [OGN-089]",
    ].join("\n");
    const deck = parseDeckText(text);
    const code = encodeDecklistToDeckCode(deck);
    const decoded = decodeDeckCodeToDecklist(code);
    const reparsed = parseDeckText(decoded.decklistRaw);
    expect(reparsed.sections.legend[0]?.cardCode).toBe("OGN-247");
    expect(reparsed.sections.champion[0]?.cardCode).toBe("OGN-039");
    expect(reparsed.sections.mainDeck[0]).toMatchObject({ count: 3, cardCode: "OGN-001" });
    expect(reparsed.totals.runes).toBe(12);
  });
});
