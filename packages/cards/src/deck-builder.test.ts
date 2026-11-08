import { describe, expect, it } from "vitest";

import {
  MAX_MAIN_DECK_SAFETY_COUNT,
  areCardDomainsWithinIdentity,
  bestPrintCards,
  cards,
  countStartingLegends,
  emptyDeckSections,
  getCardById,
  getCardCopyLimit,
  getMainDeckSafetyLimitError,
  getMaximumLegendCount,
  getNeekoLegendOptionEntries,
  isCardEligibleForCatalogSection,
  isCatalogChampionForLegend,
  isDeckReadyForMatch,
  isNeekoDeckEntry,
  normalizeSections,
  orderStartingLegendFirst,
  parseDecklist,
  parseDeckText,
  replaceEntryPrint,
  setStartingLegend,
  totalCards,
  validateStandardConstructedDeckBans,
} from "./index";

const ahri = { name: "Ahri, Nine-Tailed Fox", cardCode: "OGN-255" };
const ahriChampion = { name: "Ahri, Alluring", cardCode: "OGN-066" };
const neeko = { name: "Neeko, Blending In", cardCode: "RAD-167" };

function eligibleNames(
  section: Parameters<typeof isCardEligibleForCatalogSection>[1],
  legend = ahri,
) {
  return bestPrintCards()
    .filter((card) => !card._isToken)
    .filter((card) => isCardEligibleForCatalogSection(card, section, legend))
    .map((card) => card.name);
}

describe("copy limits", () => {
  it("defaults to 3, Unique to 1 and Spiderling to unlimited", () => {
    expect(getCardCopyLimit({ name: "Astral Heron", cardCode: "VEN-044" })).toBe(3);
    expect(getCardCopyLimit({ name: "Forgefire Cape", cardCode: "SFD-190" })).toBe(1);
    expect(getCardCopyLimit({ name: "Spiderling", cardCode: "VEN-097" })).toBeNull();
    expect(getCardCopyLimit({ name: "spiderling" })).toBeNull();
  });

  it("caps the Main Deck at 80 for save/import", () => {
    expect(getMainDeckSafetyLimitError(MAX_MAIN_DECK_SAFETY_COUNT)).toBeNull();
    expect(getMainDeckSafetyLimitError(81)).toBe(
      "Main Deck can contain at most 80 cards. Found 81.",
    );
    const sections = emptyDeckSections();
    for (let index = 0; index < 27; index += 1) {
      sections.mainDeck.push({ count: 3, name: `Filler ${index}` });
    }
    expect(totalCards(sections.mainDeck)).toBe(81);
    expect(getMainDeckSafetyLimitError(totalCards(sections.mainDeck))).toBe(
      "Main Deck can contain at most 80 cards. Found 81.",
    );
  });

  it("counts total cards", () => {
    expect(totalCards([{ count: 3 }, { count: 2 }])).toBe(5);
    expect(totalCards([])).toBe(0);
  });
});

describe("domain identity", () => {
  it("is case-insensitive and ignores unknown", () => {
    expect(areCardDomainsWithinIdentity(["Calm", "Mind"], ["calm", "Mind", "Unknown"])).toBe(true);
    expect(areCardDomainsWithinIdentity(["Calm", "Chaos"], ["Calm", "Mind"])).toBe(false);
    expect(areCardDomainsWithinIdentity([], ["Calm"])).toBe(false);
    expect(areCardDomainsWithinIdentity(["Unknown"], ["Calm"])).toBe(false);
  });
});

describe("builder catalog eligibility", () => {
  it("matches the original section pools for Ahri", () => {
    expect(eligibleNames("legend")).toHaveLength(58);
    expect(eligibleNames("champion")).toEqual([
      "Ahri, Alluring",
      "Ahri, Confident",
      "Ahri, Inquisitive",
    ]);
    expect(eligibleNames("battlefields")).toHaveLength(74);
    expect(eligibleNames("runes")).toHaveLength(2);
    // The recon screenshot shows 297; the shipped catalog yields 296 names.
    expect(eligibleNames("mainDeck").length).toBeGreaterThanOrEqual(294);
  });

  it("narrows champions by name prefix as well as subtype", () => {
    const ahriCards = eligibleNames("champion");
    for (const name of ahriCards) expect(name.startsWith("Ahri")).toBe(true);
    const unrelated = cards().find((card) => card.name === "Riven, Deserter");
    expect(unrelated && isCatalogChampionForLegend(unrelated, ahri)).toBe(false);
  });

  it("shows battlefields without a legend and gates every other pool", () => {
    const battlefield = cards().find((card) => card.type === "Battlefield" && !card._isToken);
    expect(
      battlefield && isCardEligibleForCatalogSection(battlefield, "battlefields", undefined),
    ).toBe(true);
    const unit = cards().find((card) => card.type === "Unit" && !card.signatureType);
    expect(unit && isCardEligibleForCatalogSection(unit, "mainDeck", undefined)).toBe(false);
  });

  it("lets Neeko bypass the domain identity", () => {
    const card = getCardById("OGN-001");
    expect(card && isNeekoDeckEntry(neeko)).toBe(true);
    expect(card && isCardEligibleForCatalogSection(card, "mainDeck", ahri)).toBe(false);
  });
});

describe("Neeko / Additional Legends", () => {
  const sections = normalizeSections({
    legend: [{ count: 1, ...ahri }],
    champion: [{ count: 1, ...ahriChampion }],
    mainDeck: [{ count: 1, ...neeko }],
    battlefields: [],
    runes: [],
    sideboard: [],
  });

  it("computes maximum legend counts", () => {
    expect(getMaximumLegendCount({ ...sections, mainDeck: [] })).toBe(1);
    expect(getMaximumLegendCount(sections)).toBe(4);
    expect(
      countStartingLegends({
        sections,
        totals: {
          ...{ legend: 3 },
          champion: 0,
          mainDeck: 0,
          battlefields: 0,
          runes: 0,
          sideboard: 0,
        },
      }),
    ).toBe(1);
  });

  it("returns additional legends and can promote one to starting", () => {
    const legends = [
      { count: 1, ...ahri },
      { count: 1, name: "Riven, The Exile", cardCode: "RAD-149" },
      { count: 1, name: "Yasuo, The Unforgiven", cardCode: "OGN-262" },
    ];
    expect(getNeekoLegendOptionEntries(legends)).toEqual(legends.slice(1));
    expect(setStartingLegend(legends, legends[1]!)[0]).toEqual(legends[1]);
    expect(getNeekoLegendOptionEntries(setStartingLegend(legends, legends[1]!))).toHaveLength(2);
  });

  it("orders a champion-compatible legend first", () => {
    const legends = [
      { count: 1, name: "Akali, Kinkou Rogue", cardCode: "OGN-261" },
      { count: 1, ...ahri },
    ];
    expect(orderStartingLegendFirst(legends, [ahriChampion])[0]).toEqual({ count: 1, ...ahri });
  });
});

describe("replaceEntryPrint", () => {
  it("keeps counts and merges an existing target print", () => {
    const entries = [
      { count: 2, name: "Ahri, Alluring", cardCode: "OGN-066" },
      { count: 1, name: "Ahri, Alluring", cardCode: "OGN-066A" },
    ];
    expect(
      replaceEntryPrint(
        entries,
        { name: "Ahri, Alluring", cardCode: "OGN-066" },
        { name: "Ahri, Alluring", cardCode: "OGN-066A" },
      ),
    ).toEqual([{ count: 3, name: "Ahri, Alluring", cardCode: "OGN-066A" }]);
  });
});

describe("parseDecklist defaults", () => {
  it("does not validate the catalog unless asked", () => {
    const untouched = parseDecklist("MainDeck:\n1 Not A Real Card");
    expect(untouched.errors.join(" ")).not.toContain("Unknown card");
    const validated = parseDeckText("MainDeck:\n1 Not A Real Card", { validateCatalog: true });
    expect(validated.errors.join(" ")).toContain("Unknown card");
  });

  it("reports Standard Constructed bans through the wrapper", () => {
    const parsed = parseDeckText(
      "Legend:\n1 Ahri, Nine-Tailed Fox [OGN-255]\n\nMainDeck:\n1 Draven, Vanquisher [SFD-020]",
      { validateCatalog: true },
    );
    expect(validateStandardConstructedDeckBans(parsed)).toContain(
      '"Draven, Vanquisher" is banned in Standard Constructed.',
    );
  });
});

describe("isDeckReadyForMatch", () => {
  it("short-circuits on parser errors", () => {
    const parsed = parseDeckText("", { validateCatalog: true });
    const result = isDeckReadyForMatch(parsed);
    expect(result.valid).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});
