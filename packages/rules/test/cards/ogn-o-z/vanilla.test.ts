/**
 * Origins O–Z: vanilla and keyword-only units (keywords come from the printed card and are
 * implemented by the play/combat/effects layers, not by the script).
 */
import { describe, expect, it } from "vitest";
import {
  combatKeywordProfile,
  effectiveKeywordValues,
  effectiveKeywords,
  effectiveMight,
  getCardScript,
} from "../../../src";
import { boardOf, fund } from "../../rules/effects/helpers";
import { withCards } from "./helpers";

interface Row {
  name: string;
  might: number;
  keywords: string[];
  shield?: number;
  assault?: number;
  tank?: boolean;
}

const ROWS: Row[] = [
  { name: "Pakaa Cub", might: 3, keywords: ["Hidden"] },
  { name: "Petty Officer", might: 5, keywords: ["Assault"], assault: 1 },
  { name: "Playful Phantom", might: 5, keywords: [] },
  { name: "Pouty Poro", might: 2, keywords: ["Deflect"] },
  { name: "Recruit", might: 1, keywords: [] },
  { name: "Recruit v2", might: 1, keywords: [] },
  { name: "Recruit v3", might: 1, keywords: [] },
  {
    name: "Shen, Kinkou",
    might: 3,
    keywords: ["Reaction", "Shield", "Tank"],
    shield: 2,
    tank: true,
  },
  { name: "Shipyard Skulker", might: 3, keywords: [] },
  { name: "Sprite", might: 3, keywords: ["Temporary"] },
  { name: "Stalwart Poro", might: 2, keywords: [], shield: 1 },
  { name: "Sunlit Guardian", might: 3, keywords: ["Shield", "Tank"], shield: 1, tank: true },
  { name: "Vanguard Sergeant", might: 4, keywords: [] },
];

describe("Origins O–Z vanilla / keyword-only units", () => {
  for (const row of ROWS) {
    it(`[C:${row.name}][R420][R143.4] is played at its printed cost and keeps its printed keywords`, () => {
      const s = withCards([row.name]);
      fund(s, "p1", row.name);
      s.as("p1").play(row.name).expectOk();
      const unit = s.findBoardCard(row.name)!;
      expect(unit).toBeTruthy();
      expect(s.room.rules!.pools.p1!.energy).toBe(0);
      expect(effectiveMight(s.room, unit.id, s.host)).toBe(row.might);
      const keywords = effectiveKeywords(s.room, unit.id, s.host);
      for (const keyword of row.keywords) expect(keywords).toContain(keyword);
      const profile = combatKeywordProfile(s.room, unit.id, s.host);
      expect(profile.shield).toBe(row.shield ?? 0);
      expect(profile.assault).toBe(row.assault ?? 0);
      expect(profile.tank).toBe(row.tank ?? false);
      expect(getCardScript(row.name)?.status).toBe("implemented");
    });
  }

  it("[C:Shen, Kinkou][R813][R814.1.b.3] [Reaction] lets it be played in response to a spell; [Shield 2] has value 2", () => {
    const s = withCards(["Progress Day"], ["Shen, Kinkou", "Vanguard Sergeant"]);
    fund(s, "p1", "Progress Day");
    s.as("p1").play("Progress Day").expectOk();
    // A non-Reaction unit cannot be played while the chain is open on the opponent's turn.
    fund(s, "p2", "Vanguard Sergeant");
    s.as("p2").play("Vanguard Sergeant").expectError("closed_state_requires_reaction");
    s.room.rules!.pools.p2 = { energy: 0, power: {} };
    fund(s, "p2", "Shen, Kinkou");
    s.as("p2").play("Shen, Kinkou").expectOk();
    const shen = boardOf(s, "p2").base.find((card) => card.name === "Shen, Kinkou")!;
    expect(effectiveKeywordValues(s.room, shen.id, s.host).shield).toBe(2);
  });
});
