/**
 * Wave R4-cards (VEN/OGS): Ambush (822.1.b) during a showdown at a battlefield you control —
 * R4-engine lane B merges `viaAmbush` onto the existing location option instead of dropping it
 * (308.1.a / 822.1.b).
 */
import { describe, expect, it } from "vitest";
import { fund, place } from "../../rules/effects/helpers";
import { setControl, settle, withCards, zoneOf } from "./helpers";

describe("Ambush during a showdown [R822.1.b][R308.1.a]", () => {
  it("[C:Morgana, Vindictive][R822.1.b][R308.1.a] Ambush into a controlled battlefield in a showdown there", () => {
    const s = withCards(["Morgana, Vindictive"], [], { firstPlayer: "p2" });
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    setControl(s, "battlefieldA", "p1");
    place(s, "p2", "Treasure Hunter", "base");
    s.as("p2").move("Treasure Hunter", "battlefieldA").expectOk();
    s.as("p2").pass().expectOk();
    fund(s, "p1", "Morgana, Vindictive");
    s.as("p1").play("Morgana, Vindictive", { location: "battlefieldA" }).expectOk();
    // Resolve the unit and its play effect (choose a unit to deal its marked damage to).
    for (let step = 0; step < 10; step += 1) {
      const prompt = s.room.rules!.prompt;
      if (prompt) {
        if (prompt.kind === "choose-target") {
          s.as(prompt.playerId).choose({ optionIds: [prompt.options![0]!.id] }).expectOk();
        } else if (prompt.kind === "yes-no") {
          s.as(prompt.playerId).choose({ optionIds: ["yes"] }).expectOk();
        } else {
          break;
        }
        continue;
      }
      if (s.room.rules!.chain.length === 0) break;
      s.as(s.room.rules!.priority!).pass().expectOk();
    }
    settle(s);
    const played = s.room.players
      .find((player) => player.id === "p1")!
      .board!.battlefieldA.find((card) => card.name === "Morgana, Vindictive");
    expect(played).toBeTruthy();
    expect(zoneOf(s, played!.id)).toBe("battlefieldA");
  });
});
