/**
 * RAD R4b — cards unblocked by R4-engine lanes C (last-known information, Deathknell "here") and
 * D (Deploy 830, Equip 818, attached Effect Text): Storm Raptor, Mournful Spirit, the Bomb gear
 * token and its makers, and Blade of the Exile.
 */
import { describe, expect, it } from "vitest";
import type { Prompt } from "@rift/protocol";
import { getCardScript } from "../../../src";
import { boardOf, fund, zoneOf } from "../../rules/effects/helpers";
import { put, resolveAll, settle, withCards, withDeck, type S } from "./helpers";

function drive(s: S, answerFor: (prompt: Prompt) => string[] = (prompt) =>
  prompt.options?.[0] ? [prompt.options[0].id] : [], guard = 30): void {
  for (let index = 0; index < guard; index += 1) {
    const rules = s.room.rules!;
    if (rules.prompt) {
      s.as(rules.prompt.playerId)
        .choose({ optionIds: answerFor(rules.prompt) })
        .expectOk();
      continue;
    }
    if (rules.chain.length === 0 && !rules.showdown && !rules.combat) return;
    const who = rules.priority ?? rules.focus;
    if (!who) return;
    s.as(who).pass().expectOk();
  }
}

const bombs = (s: S, player: string, zone: string) =>
  [...((boardOf(s, player) as unknown as Record<string, { id: string; name: string }[] | undefined>)[zone] ?? [])].filter(
    (card) => card.name === "Bomb",
  );

describe("RAD R4b — last-known information and Deathknell \"here\" [R383.2.c.3.b][R808]", () => {
  it("[C:Storm Raptor][R424][R383.2.c.3.b] when a stunned enemy unit here dies, draw 1", () => {
    const s = withCards(["Storm Raptor", "Vengeance"], ["Caitlyn, Patrolling"]);
    put(s, "p1", "Storm Raptor", "battlefieldA");
    const enemy = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects[enemy.id] = { baseMight: 3, stunned: true };
    fund(s, "p1", "Vengeance");
    const before = boardOf(s, "p1").hand.length;
    s.as("p1").play("Vengeance", { choices: { "target:0": enemy.id } }).expectOk();
    drive(s);
    expect(zoneOf(s, enemy.id)).toBe("trash");
    // Vengeance (-1) then Storm Raptor's draw (+1).
    expect(boardOf(s, "p1").hand.length).toBe(before);
    expect(getCardScript("Storm Raptor")?.status).toBe("implemented");
  });

  it("[C:Mournful Spirit][R383.2.c.3.b][R355.7] Deathknell: may kill a unit or gear here", () => {
    const s = withCards(["Mournful Spirit", "Vengeance"], ["Caitlyn, Patrolling"]);
    const spirit = put(s, "p1", "Mournful Spirit", "battlefieldA");
    const enemy = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects[enemy.id] = { baseMight: 20 };
    fund(s, "p1", "Vengeance");
    s.as("p1").play("Vengeance", { choices: { "target:0": spirit.id } }).expectOk();
    drive(s, (prompt) => {
      if (prompt.kind === "choose-target") return [enemy.id];
      return prompt.options?.some((option) => option.id === "yes") ? ["yes"] : [prompt.options![0]!.id];
    });
    expect(zoneOf(s, spirit.id)).toBe("trash");
    expect(zoneOf(s, enemy.id)).toBe("trash");
    expect(getCardScript("Mournful Spirit")?.status).toBe("implemented");
  });
});

describe("RAD R4b — Bomb gear token [R187][R830][R808]", () => {
  it("[C:Bomb][R830.1.b][R808.1.c] Deathknell deals 2 to an enemy unit here and kills other Bombs here", () => {
    const s = withCards(["Amateur Demolitionist", "Amateur Demolitionist", "Detonate"], ["Whiteflame Protector"]);
    for (let index = 0; index < 2; index += 1) {
      fund(s, "p1", "Amateur Demolitionist");
      s.as("p1").play("Amateur Demolitionist").expectOk();
      settle(s);
      s.as("p1").choose({ optionIds: ["battlefieldA"] }).expectOk();
      resolveAll(s);
    }
    const placed = bombs(s, "p1", "battlefieldA");
    expect(placed).toHaveLength(2);
    const enemy = put(s, "p2", "Whiteflame Protector", "battlefieldA");
    s.room.rules!.objects[enemy.id] = { baseMight: 8 };
    fund(s, "p1", "Detonate");
    s.as("p1").play("Detonate", { choices: { "target:0": placed[0]!.id } }).expectOk();
    drive(s, (prompt) => {
      if (prompt.kind === "choose-target") return [enemy.id];
      return prompt.options?.[0] ? [prompt.options[0].id] : [];
    });
    // 187: a killed token ceases to exist (it does not go to the trash). The first Deathknell
    // kills the other Bomb, whose own Deathknell deals another 2 (808.2 each instance triggers).
    expect(bombs(s, "p1", "battlefieldA")).toHaveLength(0);
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(4);
    expect(getCardScript("Bomb")?.status).toBe("implemented");
  });

  it.each([
    ["Amateur Demolitionist"],
    ["Explosimian"],
    ["Satchel Charge"],
    ["Hexplosive Minefield"],
    ["Ziggs, Explosive"],
    ["Ziggs, Hexplosives Expert"],
  ])("[C:%s][R187][R830] the Bomb maker is fully automated", (name) => {
    expect(getCardScript(name)?.status).toBe("implemented");
  });

  it("[C:Ziggs, Short-Fused][R712] only the gear Bonus Damage filter remains", () => {
    expect(getCardScript("Ziggs, Short-Fused")?.status).toBe("partial");
  });
});

describe("RAD R4b — Equipment [R818]", () => {
  it("[C:Blade of the Exile][R818.1.c][R718.3] alternative Equip cost, +3 Might and Ganking on the host", () => {
    const s = withDeck(["Blade of the Exile"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    const fodder = put(s, "p1", "Treasure Hunter", "base");
    const blade = put(s, "p1", "Blade of the Exile", "base");
    s.room.rules!.pools.p1 = { energy: 0, power: {} };
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: blade.id,
        ability: "equip:0",
        choices: { "target:0": unit.id },
        plan: { exhaust: [fodder.id] },
      } as never)
      .expectOk();
    settle(s);
    expect(s.room.rules!.manual).toBeNull();
    expect(
      boardOf(s, "p1").base.find((card) => card.name === "Blade of the Exile")!.attachedToCardId,
    ).toBe(unit.id);
    expect(getCardScript("Blade of the Exile")?.status).toBe("implemented");
  });
});
