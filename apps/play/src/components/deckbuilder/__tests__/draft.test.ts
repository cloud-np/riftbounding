import { describe, expect, it } from "vitest";

import {
  getCardById,
  isDeckReadyForMatch,
  normalizeSections,
  type DeckSections,
  type ParsedDeckEntry,
} from "@rift/cards";

import {
  addCardToSection,
  computedDeckName,
  decrementEntry,
  draftSignature,
  getAddAvailability,
  moveEntry,
  parseDeckSections,
  replacePrint,
} from "../draft";
import { computeDeckStats } from "../stats";

function section(entries: [count: number, code: string][]): ParsedDeckEntry[] {
  return entries.map(([count, code]) => {
    const card = getCardById(code);
    if (!card) throw new Error(`missing ${code}`);
    return { count, name: card.name, cardCode: card.id };
  });
}

function empty(): DeckSections {
  return { legend: [], champion: [], mainDeck: [], battlefields: [], runes: [], sideboard: [] };
}

function rivenDeck(): DeckSections {
  return normalizeSections({
    legend: section([[1, "RAD-173S"]]),
    champion: section([[1, "RAD-114A"]]),
    mainDeck: section([
      [3, "VEN-044"],
      [2, "UNL-042"],
      [1, "RAD-107"],
      [3, "RAD-150"],
      [3, "OGN-045"],
      [3, "OGN-058"],
      [2, "OGN-169"],
      [2, "OGN-048"],
      [1, "OGN-172"],
      [2, "RAD-105"],
      [2, "OGN-173"],
      [1, "UNL-128"],
      [3, "SFD-048"],
      [2, "SFD-145"],
      [2, "OGN-199"],
      [3, "SFD-130"],
      [1, "OGN-082"],
      [3, "OGN-077"],
    ]),
    battlefields: section([
      [1, "OGN-277"],
      [1, "SFD-207"],
      [1, "UNL-215"],
    ]),
    runes: section([
      [6, "VEN-R02A"],
      [6, "UNL-R05A"],
    ]),
    sideboard: section([
      [1, "OGN-056"],
      [1, "UNL-132"],
      [2, "VEN-040"],
      [2, "SFD-032"],
      [2, "SFD-045"],
      [2, "UNL-150A"],
    ]),
  });
}

describe("deckbuilder draft helpers", () => {
  it("computes the champion / legend name and signature", () => {
    const sections = rivenDeck();
    expect(computedDeckName(sections)).toBe("Riven, Deserter / Riven, The Exile");
    expect(computedDeckName(sections, true)).toBe("Riven, Deserter");
    const signature = draftSignature("  My Deck ", " guide ", sections);
    expect(signature).toContain('"name":"My Deck"');
    expect(signature).toContain('"guideHtml":"guide"');
    expect(signature).toContain("deckSections");
  });

  it("parses a complete deck with zero validation issues", () => {
    const parsed = parseDeckSections(rivenDeck());
    expect(parsed.errors).toEqual([]);
    expect(parsed.totals).toMatchObject({
      legend: 1,
      champion: 1,
      mainDeck: 39,
      battlefields: 3,
      runes: 12,
      sideboard: 10,
    });
    expect(isDeckReadyForMatch(parsed, { format: "standard-constructed" }).valid).toBe(true);
  });

  it("replaces the legend, resets the champion and auto-advances", () => {
    const sections = empty();
    const ahri = getCardById("OGN-255")!;
    const first = addCardToSection(sections, "legend", ahri);
    expect(first.nextSection).toBe("champion");
    expect(first.sections.legend).toHaveLength(1);
    const withChampion = addCardToSection(
      { ...first.sections, champion: section([[1, "OGN-066A"]]) },
      "legend",
      getCardById("RAD-149")!,
    );
    expect(withChampion.sections.champion).toEqual([]);
    expect(withChampion.sections.legend[0]?.name).toBe("Riven, The Exile");
  });

  it("enforces copy limits and battlefield limits", () => {
    let sections = empty();
    const card = getCardById("VEN-044")!;
    for (let index = 0; index < 3; index += 1) {
      const result = addCardToSection(sections, "mainDeck", card);
      expect(result.toast).toBeUndefined();
      sections = result.sections;
    }
    expect(sections.mainDeck[0]?.count).toBe(3);
    const blocked = addCardToSection(sections, "mainDeck", card);
    expect(blocked.toast).toBe('Maximum 3 copies of "Astral Heron" reached.');
    expect(blocked.sections).toBe(sections);

    let battlefields = empty();
    const bar = getCardById("OGN-277")!;
    battlefields = addCardToSection(battlefields, "battlefields", bar).sections;
    const second = addCardToSection(battlefields, "battlefields", bar);
    expect(second.toast).toBe('Only 1 copies of "Back-Alley Bar" are allowed in Battlefields.');

    const unique = getCardById("SFD-190")!;
    let uniqueDeck = addCardToSection(empty(), "mainDeck", unique).sections;
    expect(getAddAvailability(unique, "mainDeck", uniqueDeck).ok).toBe(false);
    const again = addCardToSection(uniqueDeck, "mainDeck", unique);
    expect(again.toast).toContain('Maximum 1 copies of "Forgefire Cape" reached.');
    uniqueDeck = again.sections;
    expect(uniqueDeck.mainDeck[0]?.count).toBe(1);
  });

  it("decrements and moves one copy between Main Deck and Sideboard", () => {
    const sections = rivenDeck();
    const entry = sections.mainDeck[0]!;
    const moved = moveEntry(sections, "mainDeck", entry);
    expect(moved.sections.sideboard.some((candidate) => candidate.name === entry.name)).toBe(true);
    const decremented = decrementEntry(sections, "mainDeck", entry);
    expect(decremented.mainDeck[0]?.count).toBe((entry.count ?? 1) - 1);
    const single = { count: 1, name: entry.name, cardCode: entry.cardCode };
    expect(
      decrementEntry({ ...sections, mainDeck: [single] }, "mainDeck", single).mainDeck,
    ).toEqual([]);
  });

  it("places Neeko additional legends up to four and rejects the fifth", () => {
    const neeko = getCardById("RAD-167")!;
    const base = normalizeSections({
      ...empty(),
      mainDeck: [{ count: 1, name: neeko.name, cardCode: neeko.id }],
      legend: section([[1, "RAD-149"]]),
      champion: section([[1, "RAD-114A"]]),
    });
    const second = addCardToSection(base, "legend", getCardById("OGN-255")!);
    expect(second.sections.legend).toHaveLength(2);
    const third = addCardToSection(second.sections, "legend", getCardById("OGN-262")!);
    expect(third.sections.legend).toHaveLength(3);
    const fourth = addCardToSection(third.sections, "legend", getCardById("OGN-247")!);
    expect(fourth.sections.legend).toHaveLength(4);
    const fifth = addCardToSection(fourth.sections, "legend", getCardById("OGN-261")!);
    expect(fifth.sections.legend).toHaveLength(4);
    expect(fifth.toast).toBe("Neeko already has three legends.");
  });

  it("swaps a print while keeping the count", () => {
    const sections = rivenDeck();
    const from = sections.legend[0]!;
    const next = replacePrint(sections, "legend", from, {
      name: from.name,
      cardCode: "RAD-173",
    });
    expect(next.legend[0]?.cardCode).toBe("RAD-173");
    expect(next.legend[0]?.count).toBe(1);
  });
});

describe("deck stats (Riven Tempo Midrange)", () => {
  const stats = computeDeckStats(rivenDeck(), { championCount: 1 });

  it("matches the recon's summary numbers", () => {
    expect(stats.totalMainDeckCards).toBe(39);
    expect(stats.averageEnergy?.toFixed(1)).toBe("2.8");
    expect(stats.averageMight?.toFixed(1)).toBe("3.5");
    expect(stats.powerCardCount).toBe(13);
    expect(stats.typeDistribution).toMatchObject({ unit: 15, spell: 18, gear: 6, champion: 1 });
  });

  it("matches the energy / might / power-cost curves", () => {
    expect(stats.energyCurve.map((bucket) => bucket.count)).toEqual([0, 5, 19, 8, 3, 0, 0, 3, 1]);
    expect(stats.powerCostCurve.map((bucket) => bucket.count)).toEqual([9, 4]);
    expect(stats.mightCurve.map((bucket) => bucket.count)).toEqual([3, 3, 5, 0, 0, 0, 3, 1]);
  });

  it("matches power, runes and the domain table", () => {
    expect(stats.powerSegments.map((segment) => Math.round(segment.percent))).toEqual([29, 53, 18]);
    expect(stats.runeSegments.map((segment) => Math.round(segment.percent))).toEqual([50, 50]);
    expect(stats.domainRows.map((row) => [row.label, row.cards, row.power, row.runes])).toEqual([
      ["Calm", 23, 5, 6],
      ["Chaos", 19, 9, 6],
      ["Calm / Chaos", 3, 3, null],
    ]);
  });

  it("matches the keyword counts", () => {
    expect(stats.keywords.slice(0, 7)).toEqual([
      { keyword: "Reaction", count: 13 },
      { keyword: "Hidden", count: 10 },
      { keyword: "Action", count: 7 },
      { keyword: "Equip", count: 3 },
      { keyword: "Ganking", count: 3 },
      { keyword: "Accelerate", count: 2 },
      { keyword: "Add", count: 2 },
    ]);
  });
});
