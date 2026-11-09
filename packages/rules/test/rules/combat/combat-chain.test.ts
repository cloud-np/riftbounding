/**
 * 466.2.d / 466.2.d.1 — the Combat Chain, through the real trigger queue: triggers made Pending by
 * establishing Attacker and Defender are placed Attacker first, then the non-Defenders in Turn
 * Order, then the Defender. Other simultaneous triggers during a combat keep 303.2.a / 383.3.d.1.
 */
import { afterEach, describe, expect, it } from "vitest";
import type { CardScript, GameVariant } from "@rift/protocol";
import { getCardScript, runCleanup } from "../../../src";
import { scenario } from "../../scenarios/dsl";
import { placeUnit, setControl, table } from "./helpers";
import { registerTestCardScript } from "../../../src/testing";

/** "When a player attacks, gain 1 XP." — triggers for every copy on the board (383.4.e). */
const WHEN_A_PLAYER_ATTACKS: CardScript = {
  name: "Treasure Hunter",
  text: "test: When a player attacks, gain 1 XP.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "attack", data: { player: true } } },
      effect: { op: "gain_xp", amount: 1 },
    },
  ],
};

const original = getCardScript("Treasure Hunter")!;
afterEach(() => {
  registerTestCardScript(original);
});

describe("the Combat Chain [R466.2.d][R466.2.d.1]", () => {
  it("[R466.2.d.1][R466.2.e] duel: the Attacker places triggers first, then the Defender", () => {
    registerTestCardScript(WHEN_A_PLAYER_ATTACKS);
    const s = scenario({ battlefields: { p2: "Bandle Tree" } });
    placeUnit(s, "p2", "Stellacorn Herder", "battlefieldA");
    setControl(s.room, "battlefieldA", "p2");
    placeUnit(s, "p1", "Treasure Hunter", "base");
    placeUnit(s, "p2", "Treasure Hunter", "base");
    placeUnit(s, "p1", "Clockwork Keeper", "base");
    s.as("p1").move("Clockwork Keeper", "battlefieldA").expectOk();
    const rules = s.room.rules!;
    expect(rules.combat).toMatchObject({ attacker: "p1", defender: "p2" });
    // Oldest first: the Attacker's item was placed first, so the Defender's resolves first (340.4).
    expect(rules.chain.map((item) => item.controller)).toEqual(["p1", "p2"]);
    expect(rules.chain.every((item) => item.triggerEvent?.type === "attack")).toBe(true);
    s.expectState("showdown_closed");
  });

  it("[R466.2.d.1][R303.2.a] FFA4: Attacker, then the non-Defenders in Turn Order, then the Defender", () => {
    registerTestCardScript(WHEN_A_PLAYER_ATTACKS);
    const t = table("free_for_all_4" as GameVariant);
    t.room.rules!.turn.player = "p1";
    for (const id of ["p1", "p2", "p3", "p4"]) t.place(id, "Treasure Hunter", "base");
    t.place("p3", "Stellacorn Herder", "battlefieldB");
    t.place("p2", "Clockwork Keeper", "battlefieldB");
    setControl(t.room, "battlefieldB", "p2");
    t.room.rules!.contested.battlefieldB = "p3";
    runCleanup(t.room, t.step());
    expect(t.room.rules?.combat).toMatchObject({ attacker: "p3", defender: "p2" });
    // 303.2.a alone would give p1, p2, p3, p4.
    expect(t.room.rules!.chain.map((item) => item.controller)).toEqual(["p3", "p1", "p4", "p2"]);
  });

  it("[R466.2.e] with no triggers the Combat Showdown continues Open", () => {
    const s = scenario({ battlefields: { p2: "Bandle Tree" } });
    placeUnit(s, "p2", "Stellacorn Herder", "battlefieldA");
    setControl(s.room, "battlefieldA", "p2");
    placeUnit(s, "p1", "Clockwork Keeper", "base");
    s.as("p1").move("Clockwork Keeper", "battlefieldA").expectOk();
    s.expectState("showdown_open").expectFocus("p1").expectPriority("p1");
    expect(s.room.rules?.chain).toEqual([]);
  });
});
