/**
 * RAD batch 6: simple death-trigger units.
 */
import { describe, expect, it } from "vitest";
import { effectiveMight, getCardScript } from "../../../src";
import { fund, zoneOf } from "../../rules/effects/helpers";
import { handNames, put, withCards, type S } from "./helpers";

function unit(s: S, player: string, name: string, zone: string, might: number) {
  const card = put(s, player, name, zone);
  s.room.rules!.objects[card.id] = { ...(s.room.rules!.objects[card.id] ?? {}), baseMight: might };
  return card;
}

function drive(s: S, done: () => boolean, guard = 30): void {
  for (let index = 0; index < guard && !done(); index += 1) {
    const rules = s.room.rules!;
    if (rules.prompt) {
      const first = rules.prompt.options?.[0]?.id ?? "yes";
      s.as(rules.prompt.playerId)
        .choose({ optionIds: [first] })
        .expectOk();
      continue;
    }
    const holder = rules.priority ?? rules.focus;
    if (!holder) break;
    s.as(holder).pass().expectOk();
  }
}

function killWithSpell(s: S, targetId: string): void {
  fund(s, "p1", "Lost to the Sands");
  s.as("p1")
    .play("Lost to the Sands", { choices: { mode: "deal", "target:0": targetId } })
    .expectOk();
  s.as("p2").pass().expectOk();
}

describe("RAD batch 6", () => {
  it("[C:Demacian Illuminators][R383.2][R810] a friendly unit dies: buff a friendly unit", () => {
    const s = withCards(["Lost to the Sands"], ["Demacian Illuminators", "Treasure Hunter"]);
    const lights = unit(s, "p2", "Demacian Illuminators", "base", 3);
    const fodder = unit(s, "p2", "Treasure Hunter", "battlefieldB", 1);
    killWithSpell(s, fodder.id);
    drive(s, () => effectiveMight(s.room, lights.id, s.host) === 4);
    expect(zoneOf(s, fodder.id)).toBe("trash");
    expect(effectiveMight(s.room, lights.id, s.host)).toBe(4);
  });

  it("[C:Mournful Spirit][R808] Deathknell: kill a unit or gear here (optional)", () => {
    const s = withCards(["Lost to the Sands"], ["Mournful Spirit"]);
    const spirit = unit(s, "p2", "Mournful Spirit", "battlefieldA", 1);
    const enemy = unit(s, "p1", "Treasure Hunter", "battlefieldA", 1);
    const far = unit(s, "p1", "Caitlyn, Patrolling", "battlefieldB", 3);
    killWithSpell(s, spirit.id);
    drive(s, () => zoneOf(s, enemy.id) !== "battlefieldA");
    expect(zoneOf(s, spirit.id)).toBe("trash");
    expect(zoneOf(s, enemy.id)).toBe("trash");
    expect(zoneOf(s, far.id)).toBe("battlefieldB");
  });

  it("[C:Storm Raptor][R424] partial: the stunned-death draw is not automated", () => {
    expect(getCardScript("Storm Raptor")?.status).toBe("implemented");
  });
});
