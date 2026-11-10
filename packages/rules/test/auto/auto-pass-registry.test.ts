/**
 * Guardrail for the information-safe auto-pass check (`src/auto/respond.ts`).
 *
 * "Provably no response" treats the hand and facedown cards as the only hidden sources of a
 * response. A card script that lets a player play cards from another hidden zone (the Main
 * Deck, the rune deck) would break that proof, so it must fail here until the check knows
 * about the new zone (docs/rules/auto-pass.md § hidden information).
 */
import { describe, expect, it } from "vitest";
import { cardScriptNames, getCardScript } from "../../src";

const PUBLIC_PLAY_ZONES = new Set(["trash", "banished", "champion"]);

describe("auto-pass hidden-information guardrail", () => {
  it("no card script grants plays from a hidden zone other than the hand", () => {
    const offenders: string[] = [];
    for (const name of cardScriptNames()) {
      for (const permission of getCardScript(name)?.playPermissions ?? []) {
        if (!PUBLIC_PLAY_ZONES.has(permission.zone)) offenders.push(`${name}: ${permission.zone}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
