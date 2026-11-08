import { describe, expect, it } from "vitest";

import { bestPrintCards, getCardById } from "@rift/cards";

import {
  applyCatalogFilters,
  buildFacets,
  groupCatalogCards,
  matchesSearch,
  normalizeSearchText,
  poolForSection,
  sortCatalogCards,
  type CatalogContext,
} from "../catalog";
import { EMPTY_FILTERS, type CatalogFilters } from "../types";

const ahri = { name: "Ahri, Nine-Tailed Fox", cardCode: "OGN-255" };
const riven = { count: 1, name: "Riven, The Exile", cardCode: "RAD-173" };

function context(overrides: Partial<CatalogContext> = {}): CatalogContext {
  return {
    section: "mainDeck",
    legend: riven,
    sections: {
      legend: [riven],
      champion: [],
      mainDeck: [],
      battlefields: [],
      runes: [],
      sideboard: [],
    },
    bookmarks: new Set<string>(),
    ...overrides,
  };
}

describe("catalog eligibility", () => {
  it("matches the original pool sizes for Ahri", () => {
    expect(poolForSection("legend", undefined)).toHaveLength(58);
    expect(poolForSection("champion", ahri)).toHaveLength(3);
    expect(poolForSection("battlefields", undefined)).toHaveLength(74);
    expect(poolForSection("runes", ahri)).toHaveLength(2);
    expect(poolForSection("mainDeck", ahri).length).toBeGreaterThanOrEqual(294);
    expect(poolForSection("champion", undefined)).toHaveLength(0);
  });

  it("narrows the champion pool by name prefix", () => {
    const pool = poolForSection("champion", ahri);
    expect(pool.map((card) => card.name)).toEqual([
      "Ahri, Alluring",
      "Ahri, Confident",
      "Ahri, Inquisitive",
    ]);
  });

  it("drops tokens and non-matching domains", () => {
    const pool = poolForSection("mainDeck", ahri);
    expect(pool.some((card) => card._isToken)).toBe(false);
    expect(pool.some((card) => card.id === "OGN-001")).toBe(false);
    expect(pool.some((card) => card.id === "RAD-167")).toBe(true);
  });
});

describe("catalog search", () => {
  it("normalizes diacritics, punctuation and case", () => {
    expect(normalizeSearchText("  Riven's  Exile! ")).toBe("riven s exile");
    expect(normalizeSearchText("Kai’Sa")).toBe("kai sa");
  });

  it("matches every term against the haystack", () => {
    const card = getCardById("VEN-044")!;
    expect(matchesSearch(card, "astral")).toBe(true);
    expect(matchesSearch(card, "VEN-044")).toBe(true);
    expect(matchesSearch(card, "hero heron")).toBe(true);
    expect(matchesSearch(card, "astral dragon")).toBe(false);
    expect(matchesSearch(card, "   ")).toBe(true);
  });

  it("includes set, subtypes and keywords", () => {
    const card = getCardById("SFD-190")!;
    expect(matchesSearch(card, "spiritforged")).toBe(true);
    expect(matchesSearch(card, "equip")).toBe(true);
  });
});

describe("catalog filters and facets", () => {
  const mainPool = poolForSection("mainDeck", riven);
  const ctx = context();

  it("filters by domain, type and rarity", () => {
    const filters: CatalogFilters = { ...EMPTY_FILTERS, domain: ["Calm"] };
    const fury = applyCatalogFilters(mainPool, filters, ctx);
    expect(fury.length).toBeGreaterThan(0);
    expect(fury.every((card) => card.domains.includes("Calm"))).toBe(true);

    const units = applyCatalogFilters(mainPool, { ...EMPTY_FILTERS, type: ["Unit"] }, ctx);
    expect(units.every((card) => card.type.includes("Unit"))).toBe(true);
    expect(units.length).toBeGreaterThan(0);
  });

  it("hides banned cards with Legal only", () => {
    const stacked = mainPool.find((card) => card.name === "Stacked Deck");
    expect(stacked).toBeDefined();
    const legal = applyCatalogFilters(mainPool, { ...EMPTY_FILTERS, legalOnly: true }, ctx);
    expect(legal.some((card) => card.name === "Stacked Deck")).toBe(false);
    expect(legal.length).toBeLessThan(mainPool.length);
  });

  it("filters by bookmarks and availability", () => {
    const first = mainPool[0]!;
    const bookmarked = applyCatalogFilters(
      mainPool,
      { ...EMPTY_FILTERS, bookmarkedOnly: true },
      { ...ctx, bookmarks: new Set([first.id]) },
    );
    expect(bookmarked.map((card) => card.id)).toEqual([first.id]);

    const full = context({
      sections: {
        ...ctx.sections,
        mainDeck: [{ count: 3, name: first.name, cardCode: first.id }],
      },
    });
    const available = applyCatalogFilters(
      mainPool,
      { ...EMPTY_FILTERS, availableToAdd: true },
      full,
    );
    expect(available.some((card) => card.id === first.id)).toBe(false);
  });

  it("builds counted facets from the searched pool", () => {
    const groups = buildFacets(mainPool, mainPool, { ...EMPTY_FILTERS }, ctx);
    const type = groups.find((group) => group.id === "type");
    expect(type?.options.find((option) => option.id === "Unit")?.count).toBeGreaterThan(150);
    const set = groups.find((group) => group.id === "set");
    expect(set?.options.map((option) => option.id)).toEqual(
      expect.arrayContaining(["Origins", "Spiritforged", "Unleashed", "Vendetta", "Radiance"]),
    );
    expect(groups.map((group) => group.id)).toEqual(
      expect.arrayContaining([
        "domain",
        "type",
        "rarity",
        "energy",
        "power",
        "might",
        "set",
        "keywords",
        "tags",
        "abilities",
      ]),
    );
  });

  it("hides the legend type/property facets in the Legend tab", () => {
    const legendPool = poolForSection("legend", undefined);
    const groups = buildFacets(
      legendPool,
      legendPool,
      { ...EMPTY_FILTERS },
      context({ section: "legend", legend: undefined }),
    );
    expect(groups.some((group) => group.id === "energy")).toBe(false);
    expect(groups.some((group) => group.id === "rarity")).toBe(false);
    expect(groups.some((group) => group.id === "domain")).toBe(true);
  });
});

describe("catalog sorting and grouping", () => {
  const mainPool = poolForSection("mainDeck", ahri);

  it("sorts by energy and direction", () => {
    const ascending = sortCatalogCards(mainPool, "energy", "asc");
    const energies = ascending.map((card) => card.energyCost);
    expect(energies).toEqual([...energies].sort((a, b) => a - b));
    const descending = sortCatalogCards(mainPool, "energy", "desc");
    expect(descending[0]?.energyCost).toBeGreaterThanOrEqual(
      descending[descending.length - 1]?.energyCost ?? 0,
    );
  });

  it("groups by domain and type with canonical order", () => {
    const domains = groupCatalogCards(mainPool, "domain");
    expect(domains[0]?.label).toBe("Calm");
    expect(domains.every((group) => group.cards.length > 0)).toBe(true);
    const types = groupCatalogCards(mainPool, "type");
    expect(types.map((group) => group.label)).toContain("Unit");
  });

  it("keeps the catalog unique by name", () => {
    const names = mainPool.map((card) => card.name);
    expect(new Set(names).size).toBe(names.length);
    expect(bestPrintCards().length).toBeGreaterThan(mainPool.length);
  });
});
