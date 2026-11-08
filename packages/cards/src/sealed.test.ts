import { describe, expect, it } from "vitest";

import {
  buildCollationPools,
  chaseRatePerPack,
  classifySealedTreatment,
  generateSealedPool,
  getCardById,
  getSealedFormat,
  hasMultipleLegends,
  isSealedFormatId,
  isSealedMixFormat,
  parseSealedMix,
  rareSlotReplacementChance,
  sealedFormats,
  seedLayoutFlags,
  seededRng,
  validateSealedFormat,
} from "./index";

describe("sealed formats", () => {
  it("exposes the four built-in formats", () => {
    expect(sealedFormats().map((format) => format.id)).toEqual([
      "radiance-prerift-v1",
      "unleashed-prerift-v1",
      "vendetta-prerift-v1",
      "vendetta-sealed",
    ]);
    const radiance = getSealedFormat("radiance-prerift-v1");
    expect(radiance.label).toBe("Radiance · Pre-Rift");
    expect(radiance.shortLabel).toBe("Radiance");
    expect(radiance.poolKind).toBe("pre-rift");
    expect(radiance.booster).toMatchObject({
      packsPerPool: 5,
      packsPerBox: 24,
      commonSlots: 7,
      guaranteedDomainCommons: true,
      uncommonSlots: 3,
      rareOrEpicSlots: 2,
      foilSlots: 1,
      tokenOrRuneSlots: 1,
    });
    expect(radiance.odds).toMatchObject({
      epicPerPack: 0.25,
      alternateArtPerBox: 2,
      alternateRunePerBox: 1,
      signedOvernumberedShare: 0.1,
      ultimateRarePerPack: 0.00025,
      specialArtShare: 0.5,
    });
    expect(radiance.starterKits).toHaveLength(9);
    expect(radiance.starterKits?.[0]?.id).toBe("ekko");
    expect(getSealedFormat("vendetta-sealed").booster.packsPerPool).toBe(6);
    expect(getSealedFormat("unleashed-prerift-v1").starterKits).toHaveLength(6);
  });

  it("parses mix formats in canonical set order", () => {
    expect(parseSealedMix("mix-ogn2-unl3")).toEqual([
      { setCode: "OGN", count: 2 },
      { setCode: "UNL", count: 3 },
    ]);
    expect(isSealedMixFormat("mix-rad12")).toBe(true);
    expect(isSealedMixFormat("mix-rad13")).toBe(false);
    expect(parseSealedMix("mix-unl2-ogn1")).toBeNull();
    expect(parseSealedMix("mix-xxx2")).toBeNull();
    expect(isSealedFormatId("mix-ogn1-sfd1")).toBe(true);
    const mix = getSealedFormat("mix-ogn2-unl3");
    expect(mix.label).toBe("Custom · Sealed");
    expect(mix.booster.packsPerPool).toBe(5);
    expect(mix.setCode).toBe("UNL");
  });

  it("classifies card treatments", () => {
    const format = getSealedFormat("radiance-prerift-v1");
    expect(classifySealedTreatment(format, getCardById("RAD-001")!)).toBe("base");
    expect(classifySealedTreatment(format, getCardById("RAD-168S")!)).toBe("signed-overnumbered");
    expect(classifySealedTreatment(format, getCardById("RAD-184")!)).toBe("overnumbered");
    expect(classifySealedTreatment(format, getCardById("RAD-SP1")!)).toBe("special-art");
    expect(classifySealedTreatment(format, getCardById("RAD-R01A")!)).toBe("alternate-rune");
    expect(classifySealedTreatment(format, getCardById("RAD-T02")!)).toBe("token");
    expect(classifySealedTreatment(format, getCardById("OGN-001")!)).toBe("outside-format");
    expect(classifySealedTreatment(format, getCardById("RAD-015C")!)).toBe("excluded");
  });

  it("validates built-in configs against the catalog", () => {
    for (const format of sealedFormats()) {
      const { issues, pools } = validateSealedFormat(format);
      expect(issues, `${format.id}: ${issues.map((issue) => issue.message).join(" ")}`).toEqual([]);
      expect(pools).not.toBeNull();
    }
  });

  it("builds collation pools", () => {
    const format = getSealedFormat("radiance-prerift-v1");
    const pools = buildCollationPools(format);
    expect(pools.commons.length).toBeGreaterThan(0);
    expect(pools.uncommons.length).toBeGreaterThan(0);
    expect(pools.rares.length).toBeGreaterThan(0);
    expect(pools.tokens.length).toBeGreaterThan(0);
    expect(pools.runes.length).toBeGreaterThan(0);
    expect(pools.championUnits.length).toBeGreaterThan(0);
    expect(pools.specialArts.map((card) => card.id)).toEqual([
      "RAD-SP1",
      "RAD-SP2",
      "RAD-SP3",
      "RAD-SP4",
      "RAD-SP5",
    ]);
  });

  it("computes odds helpers", () => {
    const format = getSealedFormat("radiance-prerift-v1");
    expect(chaseRatePerPack(format)).toBeCloseTo(0.00025 + 2 / 24 + 1 / 3 / 24, 10);
    expect(rareSlotReplacementChance(format)).toBeGreaterThan(0);
    expect(rareSlotReplacementChance(format)).toBeLessThanOrEqual(1);
  });

  it("derives seed layout flags", () => {
    expect(seedLayoutFlags("abc")).toEqual({ distinctPacks: false, printedLayout: false });
    expect(seedLayoutFlags("p.abc")).toEqual({ distinctPacks: true, printedLayout: false });
    expect(seedLayoutFlags("s.abc")).toEqual({ distinctPacks: true, printedLayout: true });
  });

  it("produces a stable RNG stream", () => {
    const first = seededRng("seed");
    const second = seededRng("seed");
    const values = [first(), first(), first()];
    expect(values).toEqual([second(), second(), second()]);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(seededRng("other")()).not.toBe(seededRng("seed")());
  });

  it("generates a deterministic pre-rift pool", () => {
    const a = generateSealedPool({ formatId: "radiance-prerift-v1", seed: "p.test-seed" });
    const b = generateSealedPool({ formatId: "radiance-prerift-v1", seed: "p.test-seed" });
    expect(a).toEqual(b);
    expect(a.cards).toHaveLength(15 + 5 * 14);
    expect(a.starterKitId).toBeTruthy();
    expect(a.preconDomains).toHaveLength(2);
    const starter = a.cards.filter((card) => card.source === "starter-kit");
    expect(starter).toHaveLength(15);
    const booster = a.cards.filter((card) => card.source === "booster");
    expect(booster).toHaveLength(70);
    expect(new Set(booster.map((card) => card.pack))).toEqual(new Set([1, 2, 3, 4, 5]));
    expect([...new Set(starter.map((card) => card.slot))].sort()).toEqual([
      "Battlefield",
      "Champion Unit",
      "Legend",
      "Main Deck",
    ]);
  });

  it("generates booster-only pools with the 14-card pack recipe", () => {
    const pool = generateSealedPool({ formatId: "vendetta-sealed", seed: "s.pack-test" });
    expect(pool.cards).toHaveLength(6 * 14);
    expect(pool.starterKitId).toBeUndefined();
    for (let pack = 1; pack <= 6; pack += 1) {
      const cards = pool.cards.filter((card) => card.pack === pack);
      expect(cards).toHaveLength(14);
      expect(cards.filter((card) => card.slot === "Common")).toHaveLength(7);
      expect(cards.filter((card) => card.slot === "Uncommon")).toHaveLength(3);
      expect(
        cards.filter((card) =>
          [
            "Rare",
            "Epic",
            "Overnumbered",
            "Signature Overnumbered",
            "Alt Art",
            "Special Art",
            "Ultimate Rare",
          ].includes(card.slot),
        ),
      ).toHaveLength(2);
      expect(cards.filter((card) => card.isFoil)).toHaveLength(3);
      expect(
        cards.filter((card) => ["Rune", "Alt Rune", "Token"].includes(card.slot)),
      ).toHaveLength(1);
    }
  });

  it("accepts an injected rng", () => {
    const one = generateSealedPool({
      formatId: "vendetta-sealed",
      seed: "a",
      rng: seededRng("fixed"),
    });
    const two = generateSealedPool({
      formatId: "vendetta-sealed",
      seed: "b",
      rng: seededRng("fixed"),
    });
    expect(one.cards.map((card) => card.cardCode)).toEqual(two.cards.map((card) => card.cardCode));
    expect(one.seed).toBe("a");
    expect(two.seed).toBe("b");
  });

  it("generates mix pools per set", () => {
    const pool = generateSealedPool({ formatId: "mix-ogn1-sfd1", seed: "x" });
    expect(pool.cards).toHaveLength(2 * 14);
    const setCodes = new Set(pool.cards.map((card) => card.cardCode.split("-", 1)[0]));
    expect(setCodes.has("OGN")).toBe(true);
    expect(setCodes.has("SFD")).toBe(true);
  });

  it("uses the Unleashed instance-id quirk", () => {
    const pool = generateSealedPool({ formatId: "unleashed-prerift-v1", seed: "p.x" });
    expect(pool.cards.slice(0, 4).map((card) => card.instanceId)).toEqual([
      "inst-0",
      "inst-1",
      "inst-3",
      "inst-4",
    ]);
    expect(pool.starterKitId).toBeTruthy();
  });

  it("rejects invalid seeds and unavailable formats", () => {
    expect(() => generateSealedPool({ formatId: "radiance-prerift-v1", seed: "  " })).toThrow(
      "A sealed pool seed must be non-empty.",
    );
    expect(() => generateSealedPool({ formatId: "nope", seed: "x" })).toThrow(
      'Unsupported sealed format "nope".',
    );
  });

  it("keeps Neeko multi-legend decks detectable", () => {
    expect(hasMultipleLegends).toBeTypeOf("function");
  });
});
