import { describe, expect, it } from "vitest";

import {
  cards,
  decodePercentEscapes,
  expandCounts,
  exportDeckText,
  formatDeckEntry,
  getCardById,
  hasMultipleLegends,
  normalizeSections,
  parseDeckText,
  validateDeck,
} from "./index";

function mainCards(): string[] {
  return cards()
    .filter(
      (card) =>
        (card.type === "Unit" || card.type === "Spell" || card.type === "Gear") &&
        card.domains.every((domain) => domain === "Fury" || domain === "Mind") &&
        !card.signatureType &&
        !card.bannedIn,
    )
    .slice(0, 13)
    .map((card) => card.id);
}

function legalDeckText(): string {
  const main = mainCards()
    .map((code) => `3 ${getCardById(code)?.name} [${code}]`)
    .join("\n");
  return [
    "Legend:",
    "1 Kai'Sa, Daughter of the Void [OGN-247]",
    "",
    "Champion:",
    "1 Kai'Sa, Survivor [OGN-039]",
    "",
    "MainDeck:",
    main,
    "",
    "Battlefields:",
    "1 Altar to Unity [OGN-275]",
    "1 Back-Alley Bar [OGN-277]",
    "1 Fortified Position [OGN-279]",
    "",
    "Runes:",
    "6 Fury Rune [OGN-007]",
    "6 Mind Rune [OGN-089]",
  ].join("\n");
}

describe("deck text parsing", () => {
  it("parses a legal deck with exact totals", () => {
    const deck = parseDeckText(legalDeckText());
    expect(deck.errors).toEqual([]);
    expect(deck.warnings).toEqual([]);
    expect(deck.totals).toEqual({
      legend: 1,
      champion: 1,
      mainDeck: 39,
      battlefields: 3,
      runes: 12,
      sideboard: 0,
    });
    expect(deck.sections.legend[0]?.cardCode).toBe("OGN-247");
    expect(deck.sections.mainDeck[0]?.count).toBe(3);
    expect(validateDeck(deck, { format: "standard-constructed" }).valid).toBe(true);
  });

  it("exports back to the exact section format", () => {
    const deck = parseDeckText(legalDeckText());
    const exported = exportDeckText(deck.sections);
    expect(exported.startsWith("Legend:\n1 Kai'Sa, Daughter of the Void")).toBe(true);
    expect(exported).toContain("\n\nChampion:\n1 Kai'Sa, Survivor");
    expect(exported).toContain("\n\nMainDeck:\n3 ");
    expect(exported).toContain("\n\nBattlefields:\n1 Altar to Unity");
    expect(exported).toContain("\n\nRunes:\n6 Fury Rune");
    expect(exported.endsWith("Sideboard:")).toBe(true);
    const included = exportDeckText(deck.sections, { includeCardCodes: true });
    expect(included).toContain("3 Blazing Scorcher [OGN-001]");
  });

  it("round-trips through export/parse", () => {
    const deck = parseDeckText(legalDeckText());
    const reparsed = parseDeckText(exportDeckText(deck.sections, { includeCardCodes: true }));
    expect(reparsed.sections).toEqual(deck.sections);
  });

  it("repairs fuzzy section headers and warns about unknown ones", () => {
    const deck = parseDeckText(
      legalDeckText().replace("Legend:", "Legnd:").replace("MainDeck:", "~~Main Deck~~:"),
    );
    expect(deck.errors).toContain(
      'Line 1: Unknown section header "Legnd:". Did you mean "Legend:"? This section was ignored.',
    );
    expect(deck.errors.some((error) => error.includes("Missing required section: Legend."))).toBe(
      true,
    );
  });

  it("ignores entries before a header", () => {
    const deck = parseDeckText(`3 Blazing Scorcher\n${legalDeckText()}`);
    expect(deck.warnings).toContain(
      'Line 1: Card entry "3 Blazing Scorcher" appeared before a known section header and was ignored.',
    );
  });

  it("reports unknown cards with did-you-mean suggestions", () => {
    const deck = parseDeckText(
      legalDeckText().replace("3 Blazing Scorcher [OGN-001]", "3 Blazing Scorchr"),
      { validateCatalog: true },
    );
    expect(deck.errors).toContain(
      'Line 8: Unknown card "Blazing Scorchr" in Main Deck. Did you mean "Blazing Scorcher"?',
    );
  });

  it("reports name/code mismatches and token inclusions", () => {
    const deck = parseDeckText(
      [
        "Legend:",
        "1 Kai'Sa, Daughter of the Void [OGN-247]",
        "Champion:",
        "1 Kai'Sa, Survivor [OGN-039]",
        "MainDeck:",
        "1 Blazing Scorcher [OGN-002]",
        "1 Gold [SFD-T03]",
        "Battlefields:",
        "1 Altar to Unity [OGN-275]",
        "1 Back-Alley Bar [OGN-277]",
        "1 Fortified Position [OGN-279]",
        "Runes:",
        "12 Fury Rune [OGN-007]",
      ].join("\n"),
      { validateCatalog: true },
    );
    expect(deck.errors).toContain(
      'Line 6: "Blazing Scorcher" does not match card code "OGN-002" (Brazen Buccaneer).',
    );
    expect(deck.errors).toContain(
      'Line 7: "Gold" is a token and cannot be included in deck lists.',
    );
  });

  it("checks cards belong in their type-specific sections", () => {
    const deck = parseDeckText(
      [
        "Legend:",
        "1 Blazing Scorcher [OGN-001]",
        "Champion:",
        "1 Kai'Sa, Survivor [OGN-039]",
        "MainDeck:",
        "39 Blazing Scorcher [OGN-001]",
        "Battlefields:",
        "1 Altar to Unity [OGN-275]",
        "1 Back-Alley Bar [OGN-277]",
        "1 Fortified Position [OGN-279]",
        "Runes:",
        "12 Fury Rune [OGN-007]",
      ].join("\n"),
      { validateCatalog: true },
    );
    expect(deck.errors).toContain('Line 2: "Blazing Scorcher" is not a valid Legend card.');
  });

  it("enforces copy limits, battlefield uniqueness, and the 40-card rule", () => {
    const deck = parseDeckText(
      [
        "Legend:",
        "1 Kai'Sa, Daughter of the Void [OGN-247]",
        "Champion:",
        "1 Kai'Sa, Survivor [OGN-039]",
        "MainDeck:",
        "4 Blazing Scorcher [OGN-001]",
        "Battlefields:",
        "2 Altar to Unity [OGN-275]",
        "1 Back-Alley Bar [OGN-277]",
        "Runes:",
        "12 Fury Rune [OGN-007]",
        "Sideboard:",
        "11 Blazing Scorcher [OGN-001]",
      ].join("\n"),
      { validateCatalog: true },
    );
    expect(deck.errors).toContain(
      'MainDeck contains 4 copies of "Blazing Scorcher". Maximum allowed is 3.',
    );
    expect(deck.errors).toContain(
      'Battlefields contains 2 copies of "Altar to Unity". Maximum allowed is 1.',
    );
    expect(deck.errors).toContain("Main deck + champion must contain exactly 40 card(s). Found 5.");
    expect(deck.errors).toContain("Sideboard can contain at most 10 card(s). Found 11.");
  });

  it("reports cross-section copy splits", () => {
    const deck = parseDeckText(
      legalDeckText().replace("3 Blazing Scorcher [OGN-001]", "3 Kai'Sa, Survivor [OGN-039]"),
      { validateCatalog: true },
    );
    // the champion now also appears three times in the main deck
    expect(
      deck.errors.some((warning) =>
        warning.startsWith(
          '"Kai\'Sa, Survivor" appears 4 times across Champion, Main Deck, and Sideboard. Maximum allowed is 3. Current split:',
        ),
      ),
    ).toBe(true);
  });

  it("enforces domain identity", () => {
    const deck = parseDeckText(
      legalDeckText().replace("3 Blazing Scorcher [OGN-001]", "3 Fight or Flight [OGN-168]"),
      {
        validateCatalog: true,
      },
    );
    expect(
      deck.errors.some((warning) =>
        warning.includes("whose Chaos domain is outside this deck's Fury/Mind domain identity."),
      ),
    ).toBe(true);
  });

  it("enforces main deck size and total card caps", () => {
    const deck = parseDeckText(
      [
        "Legend:",
        "1 Kai'Sa, Daughter of the Void [OGN-247]",
        "Champion:",
        "1 Kai'Sa, Survivor [OGN-039]",
        "MainDeck:",
        "90 Blazing Scorcher [OGN-001]",
        "90 Brazen Buccaneer [OGN-002]",
        "90 Chemtech Enforcer [OGN-003]",
        "Battlefields:",
        "1 Altar to Unity [OGN-275]",
        "1 Back-Alley Bar [OGN-277]",
        "1 Fortified Position [OGN-279]",
        "Runes:",
        "12 Fury Rune [OGN-007]",
      ].join("\n"),
      { validateCatalog: true },
    );
    expect(deck.errors).toContain("Main Deck can contain at most 80 cards. Found 270.");
    expect(deck.errors).toContain("Deck list can contain at most 250 total cards. Found 287.");
  });

  it("warns about oversized raw lists with locale-formatted numbers", () => {
    const deck = parseDeckText("x".repeat(20001));
    expect(deck.errors[0]).toBe("Deck list cannot exceed 20,000 characters. Found 20,001.");
  });

  it("supports unrestricted mode (optional battlefields, ban warnings)", () => {
    const deck = parseDeckText(
      [
        "Legend:",
        "1 Kai'Sa, Daughter of the Void [OGN-247]",
        "Champion:",
        "1 Kai'Sa, Survivor [OGN-039]",
        "MainDeck:",
        "3 Ekko, Recurrent [OGN-110]",
      ].join("\n"),
      { deckRulesMode: "unrestricted" },
    );
    expect(deck.errors).not.toContain("Missing required section: Battlefields.");
    expect(deck.warnings).toContain('"Ekko, Recurrent" is banned in Standard Constructed.');
  });

  it("unrestricted paste validation only blocks a missing Main Deck (original lobby signed-out state)", () => {
    const deck = parseDeckText(
      [
        "LEGEND",
        "1 Riven, The Exile",
        "",
        "CHAMPION",
        "1 Riven, Deserter",
        "",
        "MAIN DECK",
        "3 Astral Heron",
        "2 Back Off",
        "",
        "BATTLEFIELDS",
        "1 Back-Alley Bar",
        "1 Emperor's Dais",
        "1 Star Spring",
        "",
        "RUNES",
        "6 Calm Rune",
        "6 Chaos Rune",
      ].join("\n"),
      { deckRulesMode: "unrestricted" },
    );
    expect(deck.errors).toEqual(["Missing required section: Main Deck."]);
    expect(deck.warnings).toContain("Missing required section: Legend.");
    expect(deck.warnings).toContain("Missing required section: Champion.");
    expect(deck.warnings).toContain("Legend must contain exactly 1 card(s). Found 0.");
    expect(deck.warnings).toContain("Champion must contain exactly 1 card(s). Found 0.");
  });

  it("validates bans before matchmaking", () => {
    const deck = parseDeckText(
      legalDeckText().replace("3 Blazing Scorcher [OGN-001]", "3 Ekko, Recurrent [OGN-110]"),
      {
        validateCatalog: true,
      },
    );
    const result = validateDeck(deck, { format: "standard-constructed" });
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('"Ekko, Recurrent" is banned in Standard Constructed.');
    const emptyBattlefields = {
      raw: "",
      sections: {
        legend: [],
        champion: [],
        mainDeck: [{ count: 40, name: "Blazing Scorcher" }],
        battlefields: [],
        runes: [],
        sideboard: [],
      },
      totals: { legend: 0, champion: 0, mainDeck: 40, battlefields: 0, runes: 0, sideboard: 0 },
      warnings: [],
      errors: [],
    };
    expect(
      validateDeck(emptyBattlefields, {
        format: "standard-constructed",
        deckRulesMode: "standard",
      }),
    ).toEqual({
      valid: false,
      reasons: ["No battlefields were found in the deck list."],
    });
  });

  it("handles Additional Legends and Neeko", () => {
    const text = [
      "Legend:",
      "1 Kai'Sa, Daughter of the Void [OGN-247]",
      "1 Vi, Destructive [OGN-036]",
      "Champion:",
      "1 Kai'Sa, Survivor [OGN-039]",
      "MainDeck:",
      "1 Neeko, Blending In [RAD-167]",
      "39 Blazing Scorcher [OGN-001]",
      "Battlefields:",
      "1 Altar to Unity [OGN-275]",
      "1 Back-Alley Bar [OGN-277]",
      "1 Fortified Position [OGN-279]",
      "Runes:",
      "12 Fury Rune [OGN-007]",
    ].join("\n");
    const deck = parseDeckText(text);
    expect(hasMultipleLegends(deck.sections)).toBe(true);
    expect(deck.totals.legend).toBe(2);
    const exported = exportDeckText(deck.sections);
    expect(exported).toContain("\n\nAdditional Legends:\n1 ");
    expect(exportDeckText(deck.sections, { includeCardCodes: true })).toContain("[OGN-036]");
  });

  it("expands counts and normalizes sections", () => {
    const deck = parseDeckText(legalDeckText());
    const expanded = expandCounts([{ count: 3, name: "Blazing Scorcher", cardCode: "OGN-001" }]);
    expect(expanded).toHaveLength(3);
    expect(expanded[0]).toEqual({ count: 1, name: "Blazing Scorcher", cardCode: "OGN-001" });
    const normalized = normalizeSections({
      ...deck.sections,
      mainDeck: [
        { count: 1, name: "Blazing Scorcher", cardCode: "OGN-001" },
        { count: 2, name: "Blazing Scorcher", cardCode: "OGN-001" },
      ],
    });
    expect(normalized.mainDeck).toEqual([
      { count: 3, name: "Blazing Scorcher", cardCode: "OGN-001" },
    ]);
    expect(formatDeckEntry({ count: 3, name: "Blazing Scorcher", cardCode: "OGN-001" }, true)).toBe(
      "3 Blazing Scorcher [OGN-001]",
    );
  });

  it("decodes percent-escaped deck lists", () => {
    expect(decodePercentEscapes("Legend%3A%0A1%20Card")).toBe("Legend:\n1 Card");
    expect(decodePercentEscapes("Legend: 1 Card")).toBe("Legend: 1 Card");
  });
});
