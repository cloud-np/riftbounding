import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { renderSentence, SENTENCE_TEMPLATES } from "../src/log/templates";

const ROOT = path.resolve(__dirname, "../../..");
const CATALOG = path.join(ROOT, ".recon/specs/game-log-en.json");

describe.skipIf(!fs.existsSync(CATALOG))("game-log templates", () => {
  it("matches the canonical English catalogue byte-for-byte", () => {
    const catalogue = JSON.parse(fs.readFileSync(CATALOG, "utf8")) as Record<string, string>;
    let checked = 0;
    for (const [key, template] of Object.entries(SENTENCE_TEMPLATES)) {
      const canonical = catalogue[`sentence.${key}`];
      if (typeof canonical !== "string") continue;
      expect(template, key).toBe(canonical);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(40);
  });

  it("renders plurals and parameters", () => {
    expect(renderSentence("drewCards", { count: 1 })).toBe("drew 1 card.");
    expect(renderSentence("drewCards", { count: 3 })).toBe("drew 3 cards.");
    expect(renderSentence("rolledDie", { sides: 20, result: 7 })).toBe("rolled a d20: 7.");
    expect(renderSentence("scoredAtTurnStart", { points: 1, from: 3, to: 4 })).toContain("3 → 4");
  });
});
