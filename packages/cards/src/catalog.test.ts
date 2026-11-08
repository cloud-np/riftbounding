import { describe, expect, it } from "vitest";

import {
  ASSET_MANIFEST,
  bestPrintCards,
  cards,
  cardNumber,
  compareCards,
  effectiveMight,
  getCard,
  getCardById,
  getCardByName,
  getCardsByNameAll,
  hasKeyword,
  imageUrlOf,
  isChampionForLegend,
  isTokenRow,
  keywordIconCandidates,
  legendTagOf,
  normalizeCardName,
  primaryTypeWord,
  resolveCard,
  resolveCardTypeWords,
  resolveCardTypes,
  rulesTextOf,
  searchTokens,
  splitCardText,
  errataTextOf,
  tokenCardsOf,
} from "./index";

describe("catalog", () => {
  it("loads the full 1510-card catalog", () => {
    expect(cards()).toHaveLength(1510);
  });

  it("looks cards up by id and signed-print fallback", () => {
    expect(getCardById("OGN-001")?.name).toBe("Blazing Scorcher");
    expect(getCardById("OGN-007AS")?.id).toBe("OGN-007A");
    expect(getCardById("NOPE-999")).toBeUndefined();
    expect(getCard("ARC-001")?.name).toBe("Vi, Destructive");
  });

  it("normalizes names for by-name lookup", () => {
    expect(getCardByName("Kai'Sa, Survivor")?.id).toBe("OGN-039");
    expect(getCardByName("kai’sa, survivor")?.id).toBe("OGN-039");
    expect(normalizeCardName("Kai'Sa, Survivor")).toBe("kaisa survivor");
    expect(resolveCard(undefined, "Blazing Scorcher")?.id).toBe("OGN-001");
  });

  it("indexes alt-art prints to their base card", () => {
    expect(getCardById("OGN-007A")?.baseCardId).toBe("OGN-007");
    expect(getCardsByNameAll("Fury Rune").map((card) => card.id)).toContain("OGN-007A");
  });

  it("prefers the best print by comparator", () => {
    const prints = getCardsByNameAll("Fury Rune");
    expect(prints[0]?.id).toBe("OGN-007");
    expect(bestPrintCards().every((card) => card.id === getCardByName(card.name)?.id)).toBe(true);
    const alt = getCardById("OGN-007A");
    const base = getCardById("OGN-007");
    expect(alt && base && compareCards(base, alt)).toBe(true);
  });

  it("splits only known multi-word types", () => {
    expect(resolveCardTypeWords("Unit Gear")).toEqual(["Unit", "Gear"]);
    expect(resolveCardTypeWords("Champion Unit")).toEqual(["Champion", "Unit"]);
    expect(primaryTypeWord("Unit Gear")).toBe("unit");
  });

  it("resolves runtime card types for tokens and catalog cards", () => {
    expect(resolveCardTypes({ source: "token", name: "Gold" })).toEqual(["gear"]);
    expect(resolveCardTypes({ cardCode: "VEN-058" })).toEqual(["unit", "gear"]);
    expect(resolveCardTypes({ type: "Unit", source: "token", name: "Bird" })).toEqual(["unit"]);
  });

  it("finds champion units for a legend tag", () => {
    const legend = getCardById("OGN-247");
    expect(legend?.subtypes?.[0]).toBe("Kai'Sa");
    const champion = getCardById("OGN-039");
    expect(champion && isChampionForLegend(champion, "Kai'Sa")).toBe(true);
    expect(champion && isChampionForLegend(champion, "Vi")).toBe(false);
    expect(tokenCardsOf("Kai'Sa").some((card) => card.id === "OGN-039")).toBe(true);
  });

  it("derives legend tags for signature cards", () => {
    const signature = cards().find((card) => card.signatureType);
    expect(signature).toBeDefined();
    expect(legendTagOf(signature!)).toBeTruthy();
  });

  it("detects token rows and resolves token might/art", () => {
    expect(isTokenRow(getCardById("UNL-T02")!)).toBe(true);
    expect(isTokenRow(getCardById("OGN-001")!)).toBe(false);
    expect(effectiveMight({ source: "token", name: "Mech" })).toBe(3);
    expect(imageUrlOf({ source: "token", name: "Gold" })).toBe("/tokens/Gold.webp");
  });

  it("checks keywords from runtime and catalog data", () => {
    expect(hasKeyword({ cardCode: "OGN-001" }, "Accelerate")).toBe(true);
    expect(hasKeyword({ keywords: ["Reaction"] }, "reaction")).toBe(true);
    expect(hasKeyword({ keywords: ["Reaction"] }, " ")).toBe(false);
  });

  it("suggests fuzzy card names", () => {
    expect(searchTokens("Blazing Scorcher")[0]).toBe("Blazing Scorcher");
    expect(searchTokens("Blazing Scorchr")[0]).toBe("Blazing Scorcher");
    expect(searchTokens("zzzzzzzzzz")).toEqual([]);
  });

  it("splits rules/flavor text and extracts errata", () => {
    expect(splitCardText("Do a thing.\nFlavor Text\nSome flavor.")).toEqual({
      rulesText: "Do a thing.",
      flavorText: "Some flavor.",
    });
    expect(splitCardText("Only rules.")).toEqual({ rulesText: "Only rules.", flavorText: null });
    expect(splitCardText("Flavor Text\nJust flavor.")).toEqual({
      rulesText: null,
      flavorText: "Just flavor.",
    });
    expect(rulesTextOf("Rules.\nFlavor Text\nFlavor.")).toBe("Rules.");
    expect(errataTextOf("Card Errata Text\nUpdated rules.")).toBe("Updated rules.");
  });

  it("builds inline icon candidates from the manifest", () => {
    expect(keywordIconCandidates("Assault 2")).toEqual([
      `https://assets.riftatlas-workers.com/riftbound/static/icons/assault_2.webp?v=${ASSET_MANIFEST["icons/assault_2.webp"]}`,
      `https://assets.riftatlas-workers.com/riftbound/static/icons/assault_2.svg?v=${ASSET_MANIFEST["icons/assault_2.svg"]}`,
      `https://assets.riftatlas-workers.com/riftbound/static/icons/assault.webp?v=${ASSET_MANIFEST["icons/assault.webp"]}`,
      `https://assets.riftatlas-workers.com/riftbound/static/icons/assault.svg?v=${ASSET_MANIFEST["icons/assault.svg"]}`,
    ]);
    expect(keywordIconCandidates("Unknown Icon")).toEqual([]);
  });

  it("uses card numbers for ordering", () => {
    expect(cardNumber("OGN-042A")).toBe(42);
    expect(cardNumber("BLAH")).toBeNull();
  });
});
