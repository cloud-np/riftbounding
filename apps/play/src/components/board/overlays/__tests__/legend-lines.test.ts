import { cards } from "@rift/cards";
import { describe, expect, it } from "vitest";

import {
  GENERIC_LINES,
  LEGEND_LINES,
  candidateLines,
  legendChampion,
  linesForLegend,
  pickLegendLine,
} from "../legend-lines";

const legends = cards().filter((card) => /legend/i.test(card.type ?? ""));

describe("legend lines", () => {
  it("has legends in the catalog", () => {
    expect(legends.length).toBeGreaterThan(40);
  });

  it("resolves every catalog legend to its own pool (not the generic fallback)", () => {
    const missing = legends.filter((card) => linesForLegend(card.name) === GENERIC_LINES).map((card) => card.name);
    expect(missing).toEqual([]);
  });

  it("maps names to champions", () => {
    expect(legendChampion("Jinx, Loose Cannon")).toBe("Jinx");
    expect(legendChampion("Master Yi, Wuju Bladesman")).toBe("Master Yi");
    expect(legendChampion("Jarvan IV, Exemplar of Demacia")).toBe("Jarvan IV");
    expect(legendChampion(null)).toBeNull();
  });

  it("keeps every pool well-formed (2+ win/lose lines, <= 120 chars, no duplicates)", () => {
    for (const [champion, pools] of Object.entries({ ...LEGEND_LINES, Generic: GENERIC_LINES })) {
      expect(pools.win.length, `${champion} win`).toBeGreaterThanOrEqual(2);
      expect(pools.lose.length, `${champion} lose`).toBeGreaterThanOrEqual(2);
      const all = Object.values(pools).flat() as string[];
      for (const line of all) {
        expect(line.length, `${champion}: ${line}`).toBeLessThanOrEqual(120);
        expect(line.trim()).toBe(line);
      }
      expect(new Set(all).size, `${champion} duplicates`).toBe(all.length);
    }
  });

  it("has no pool keyed by a champion that is not in the catalog", () => {
    const champions = new Set(legends.map((card) => legendChampion(card.name)));
    expect(Object.keys(LEGEND_LINES).filter((key) => !champions.has(key))).toEqual([]);
  });

  it("prefers a fitting situation over the base pool, with a fallback", () => {
    const name = "Garen, Might of Demacia";
    expect(candidateLines({ legendName: name, won: true, situations: ["conquer"] })).toEqual(LEGEND_LINES.Garen!.conquer);
    expect(candidateLines({ legendName: name, won: false, situations: ["conquer"] })).toEqual(LEGEND_LINES.Garen!.lose);
    expect(candidateLines({ legendName: name, won: true, situations: ["concession"] })).toEqual(LEGEND_LINES.Garen!.oppConceded);
    expect(candidateLines({ legendName: name, won: false, situations: ["concession"] })).toEqual(LEGEND_LINES.Garen!.iConceded);
    expect(candidateLines({ legendName: "Jinx, Loose Cannon", won: true, situations: ["hold"] })).toEqual(LEGEND_LINES.Jinx!.win);
    expect(candidateLines({ legendName: "Nobody, Unknown", won: true, situations: [] })).toEqual(GENERIC_LINES.win);
  });

  it("is stable for a seed and varies across seeds", () => {
    const base = { legendName: "Jinx, Loose Cannon", won: true, situations: [] as never[] };
    const a = pickLegendLine({ ...base, seed: "ROOM#1#9" });
    expect(pickLegendLine({ ...base, seed: "ROOM#1#9" })).toEqual(a);
    expect(a.attribution).toBe("Jinx");
    const seen = new Set(Array.from({ length: 40 }, (_, i) => pickLegendLine({ ...base, seed: `s${i}` }).text));
    expect(seen.size).toBeGreaterThan(1);
  });
});
