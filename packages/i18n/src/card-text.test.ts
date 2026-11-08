import { describe, expect, it } from "vitest";

import {
  getLocalizedCardText,
  getLocalizedFlavorText,
  getLocalizedRulesText,
  localizedCardTextCount,
  localizedCardTextLocales,
} from "./index";

describe("localized card text", () => {
  it("resolves printed rules text", () => {
    const text = getLocalizedCardText("fr", "RAD-063");
    expect(text?.rulesText).toContain("Désarmement");
    expect(text?.rulesEvidence).toBe("verified-first-party-scan-transcription");
    expect(text?.sourceCardId).toBe("RAD-063");
  });

  it("prefers official errata", () => {
    const text = getLocalizedCardText("fr", "RAD-010");
    expect(text?.rulesText).toContain("Préparez une unité.");
    expect(text?.rulesEvidence).toBe("verified-official-errata");
  });

  it("resolves derived prints through their base print", () => {
    const text = getLocalizedCardText("fr", "RAD-015");
    expect(text?.sourceCardId).toBe("RAD-SP2");
    expect(text?.rulesEvidence).toBe("derived-physical-base-print");
    expect(text?.flavorText).toBeNull();
  });

  it("applies flavor overrides", () => {
    expect(getLocalizedFlavorText("fr", "RAD-063")).toBe("« Belle journée pour chasser. »");
    expect(getLocalizedCardText("fr", "RAD-063")?.flavorEvidence).toBe(
      "verified-first-party-scan-transcription",
    );
  });

  it("resolves Korean text", () => {
    const text = getLocalizedCardText("ko", "OGN-001");
    expect(text?.rulesText).toContain("[가속]");
    expect(text?.rulesEvidence).toBe("verified-official-catalog");
  });

  it("resolves zh-CN text, errata and flavor", () => {
    expect(getLocalizedRulesText("zh-CN", "ARC-001")).toContain("游走");
    expect(getLocalizedFlavorText("zh-CN", "ARC-001")).toBe("“先打一拳，打的时候再把问题问遍！”");
    const errata = getLocalizedCardText("zh-CN", "OGN-118");
    expect(errata?.rulesText).toBe("每回合首次：当另一名友方单位被摧毁时，抽一张牌。");
    expect(errata?.sourceRulesText).toBe(
      "The first time another friendly unit dies each turn, draw 1",
    );
    expect(errata?.rulesEvidence).toBe("project-translated-official-errata");
  });

  it("returns null for EN / unknown prints", () => {
    expect(getLocalizedCardText("en", "OGN-001")).toBeNull();
    expect(getLocalizedCardText("fr", "NOPE-999")).toBeNull();
    expect(localizedCardTextLocales()).toEqual(["fr", "ko", "zh-CN"]);
    expect(localizedCardTextCount("fr")).toBeGreaterThan(700);
    expect(localizedCardTextCount("zh-CN")).toBeGreaterThan(1400);
    expect(localizedCardTextCount("en")).toBe(0);
  });
});
