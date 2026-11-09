/**
 * Steps of Combat end to end — rules 462–468 through real intents.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  registerActionInterceptor,
  registerCleanupHook,
} from "../../../src";
import { clearCardScripts, registerTestCardScript } from "../../../src/testing";
import { scenario, type RulesScenario } from "../../scenarios/dsl";
import {
  boardOf,
  controllerOf,
  damageData,
  eventTypes,
  passUntilSettled,
  placeUnit,
  setControl,
} from "./helpers";

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()!();
  clearCardScripts();
});

/** p2 controls battlefieldA with `defenders`; p1 moves `attacker` in from base (190.3.a.1). */
function attackScenario(
  attacker: string,
  defenders: string[],
  extra: { p1?: string[]; p2?: string[] } = {},
): RulesScenario {
  const s = scenario({ battlefields: { p2: "Bandle Tree" }, extraCards: extra });
  defenders.forEach((name, index) => placeUnit(s, "p2", name, "battlefieldA", `def-${index}`));
  setControl(s.room, "battlefieldA", "p2");
  placeUnit(s, "p1", attacker, "base", "atk-0");
  s.as("p1").move(attacker, "battlefieldA").expectOk();
  return s;
}

describe("combat opening [R462][R466]", () => {
  it("[R466.2.c.1][R466.2.c.2][R466.2.c.1.a][R466.2.c.3] the Contested applier attacks with Focus; designations and attack/defend events", () => {
    const s = attackScenario("Astral Heron", ["Treasure Hunter"]);
    const rules = s.room.rules!;
    expect(rules.combat).toMatchObject({ battlefield: "battlefieldA", attacker: "p1", defender: "p2", step: "showdown" });
    expect(rules.showdown?.kind).toBe("combat");
    expect(rules.focus).toBe("p1");
    expect(rules.priority).toBe("p1");
    expect(rules.objects["atk-0"]?.designation).toBe("attacker");
    expect(rules.objects["def-0"]?.designation).toBe("defender");
    const types = eventTypes(s.events());
    expect(types.indexOf("combat_begin")).toBeLessThan(types.indexOf("showdown_begin"));
    const attacks = s.events().filter((event) => event.type === "attack");
    expect(attacks.map((event) => event.cardId ?? "player")).toEqual(["player", "atk-0"]);
    expect(s.events().filter((event) => event.type === "defend").map((event) => event.cardId ?? "player")).toEqual([
      "player",
      "def-0",
    ]);
  });

  it("[R383.4.e.2.a][R323.2.c][R323.2.a] regaining the Attacker designation in the same combat does not emit a second attack event", () => {
    const s = attackScenario("Astral Heron", ["Treasure Hunter"]);
    const heron = boardOf(s, "p1").battlefieldA.find((card) => card.id === "atk-0")!;
    expect(s.host.moveCard(s.room, "p1", "battlefieldA", "base", heron.id)).toBe(true);
    s.as("p1").pass().expectOk();
    expect(s.room.rules?.objects["atk-0"]?.designation).toBeUndefined();
    expect(s.host.moveCard(s.room, "p1", "base", "battlefieldA", heron.id)).toBe(true);
    s.as("p2").pass().expectOk();
    // The Cleanup after this pass re-designated the unit (323.2.a) before the damage step, without
    // a new 383.4.e trigger event; it then fought and won.
    expect(s.events().some((event) => event.type === "attack" && event.cardId === "atk-0")).toBe(false);
    expect(s.events().find((event) => event.type === "damage_assigned" && event.playerId === "p1")?.amount).toBe(7);
  });
});

describe("combat damage and resolution [R467][R468]", () => {
  it("[R467.2.c][R467.2.d][R468.3.a][R468.5][R468.5.d][R471.1] the attacker kills the only defender, wins and conquers", () => {
    const s = attackScenario("Astral Heron", ["Treasure Hunter"]);
    const events = passUntilSettled(s);
    const types = eventTypes(events);
    // Unique assignments are made automatically (contract), Attacker first (467.2.c).
    const assigned = events.filter((event) => event.type === "damage_assigned");
    expect(assigned.map((event) => [event.playerId, event.amount, event.data?.auto])).toEqual([
      ["p1", 7, true],
      ["p2", 1, true],
    ]);
    expect(types).toContain("combat_damage");
    expect(boardOf(s, "p2").trash.some((card) => card.id === "def-0")).toBe(true);
    // 468.1.a.1: the surviving attacker is healed by the Combat Cleanup.
    expect(s.room.rules?.objects["atk-0"]?.damage).toBeUndefined();
    const result = events.find((event) => event.type === "combat_result");
    expect(result?.data).toMatchObject({ winner: "p1", loser: "p2", noResult: false });
    expect(events.filter((event) => event.type === "establish_control")).toHaveLength(1);
    expect(types).toContain("conquer");
    expect(controllerOf(s.room, "battlefieldA")).toBe("p1");
    expect(s.room.rules?.contested.battlefieldA).toBeUndefined();
    s.expectScore("p1", 1);
    expect(s.room.rules?.combat).toBe(null);
    expect(types[types.length - 1] === "combat_end" || types.includes("combat_end")).toBe(true);
    // 468.7 → 312.2.a: back to Neutral Open with the Turn Player holding Priority.
    s.expectState("neutral_open").expectPriority("p1").expectFocus(null);
  });

  it("[R468.1.a.2][R468.3.d][R740.3.a] both sides survive: attackers are recalled and there is No Result", () => {
    const s = attackScenario("Treasure Hunter", ["Stellacorn Herder"]);
    // 424.1.b: the stunned defender contributes no Might, so both units survive.
    s.room.rules!.objects["def-0"] = { ...(s.room.rules!.objects["def-0"] ?? {}), stunned: true };
    const events = passUntilSettled(s);
    expect(events.find((event) => event.type === "damage_assigned" && event.playerId === "p2")?.amount).toBe(0);
    expect(boardOf(s, "p1").base.some((card) => card.id === "atk-0")).toBe(true);
    expect(events.some((event) => event.type === "recall" && event.cardId === "atk-0")).toBe(true);
    expect(events.find((event) => event.type === "combat_result")?.data).toMatchObject({
      winner: null,
      noResult: true,
      recalled: true,
    });
    // The defender kept control and nobody scored.
    expect(controllerOf(s.room, "battlefieldA")).toBe("p2");
    expect(events.some((event) => event.type === "establish_control")).toBe(false);
    s.expectScore("p1", 0).expectScore("p2", 0);
  });

  it("[R468.3.d][R468.5.b] both sides die: No Result and the battlefield becomes Uncontrolled", () => {
    const s = attackScenario("Stellacorn Herder", ["Stellacorn Herder"]);
    const events = passUntilSettled(s);
    expect(boardOf(s, "p1").trash.some((card) => card.id === "atk-0")).toBe(true);
    expect(boardOf(s, "p2").trash.some((card) => card.id === "def-0")).toBe(true);
    expect(events.find((event) => event.type === "combat_result")?.data).toMatchObject({ noResult: true, recalled: false });
    expect(events.find((event) => event.type === "lose_control")).toMatchObject({ playerId: "p2", zone: "battlefieldA" });
    expect(controllerOf(s.room, "battlefieldA")).toBe(null);
  });

  it("[R468.3.a][R468.3.b][R468.5] the defender wins and, already in control, does not conquer", () => {
    const s = attackScenario("Treasure Hunter", ["Stellacorn Herder"]);
    const events = passUntilSettled(s);
    expect(boardOf(s, "p1").trash.some((card) => card.id === "atk-0")).toBe(true);
    expect(events.find((event) => event.type === "combat_result")?.data).toMatchObject({ winner: "p2", loser: "p1" });
    expect(events.some((event) => event.type === "establish_control")).toBe(false);
    expect(events.some((event) => event.type === "conquer")).toBe(false);
    expect(controllerOf(s.room, "battlefieldA")).toBe("p2");
    s.expectScore("p2", 0);
  });

  it("[R467.1] with no Attacking units left the damage step is skipped", () => {
    const s = attackScenario("Astral Heron", ["Treasure Hunter"]);
    expect(s.host.moveCard(s.room, "p1", "battlefieldA", "base", "atk-0")).toBe(true);
    const events = passUntilSettled(s);
    expect(events.some((event) => event.type === "damage_assigned")).toBe(false);
    expect(events.some((event) => event.type === "combat_damage")).toBe(false);
    expect(events.find((event) => event.type === "combat_result")?.data).toMatchObject({ winner: "p2" });
  });

  it("[R468.3.d.1][R468.5] No Result with both players' units remaining stages a Showdown and a Combat; combat restarts", () => {
    const s = attackScenario("Treasure Hunter", ["Stellacorn Herder"]);
    s.room.rules!.objects["def-0"] = { ...(s.room.rules!.objects["def-0"] ?? {}), stunned: true };
    // A replacement effect prevents the 468.1.a.2 recall, so both players still have units.
    cleanups.push(registerActionInterceptor((_room, _step, proposal) => (proposal.type === "recall" ? null : proposal)));
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    const events = s.events();
    expect(events.find((event) => event.type === "combat_result")?.data).toMatchObject({ noResult: true, recalled: false });
    // 468.5 is skipped (staged), Contested stays with p1, and the 319.1 Cleanup after 468.7 opens
    // the staged Combat again with the same Attacker.
    expect(events.some((event) => event.type === "establish_control")).toBe(false);
    const begins = events.filter((event) => event.type === "combat_begin");
    expect(begins).toHaveLength(1);
    expect(s.room.rules?.combat).toMatchObject({ battlefield: "battlefieldA", attacker: "p1", defender: "p2" });
    expect(s.room.rules?.contested.battlefieldA).toBe("p1");
  });

  it("[R468.2][R468.4] the combat result waits until chain items from the Combat Cleanup resolve", () => {
    registerTestCardScript({
      name: "Combat Cleanup Probe",
      text: "test trigger",
      status: "implemented",
      abilities: [{ kind: "triggered", trigger: { kind: "custom", id: "probe" }, effect: { op: "seq", effects: [] } }],
    });
    const s = attackScenario("Astral Heron", ["Treasure Hunter"]);
    let added = false;
    cleanups.push(
      registerCleanupHook("afterStep3a", (room, step) => {
        const rules = room.rules!;
        if (added || rules.combat?.step !== "resolution") return;
        added = true;
        rules.chain.push({
          id: step.host.nextId("chain"),
          kind: "triggered",
          status: "pending",
          controller: "p2",
          cardName: "Combat Cleanup Probe",
          abilityRef: "triggered:custom",
          choices: {},
          origin: "trigger",
        });
      }),
    );
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    // The Combat Cleanup ran (the defender died) but 468.3 waits for the chain (468.2).
    expect(boardOf(s, "p2").trash.some((card) => card.id === "def-0")).toBe(true);
    expect(s.events().some((event) => event.type === "combat_result")).toBe(false);
    expect(s.room.rules?.combat?.step).toBe("resolution");
    expect(s.room.rules?.history.combatProgress?.waiting).toBe(true);
    s.expectState("showdown_closed").expectPriority("p2");
    // Both players pass; the item resolves; the result and the Conquer follow.
    const events = passUntilSettled(s);
    expect(eventTypes(events)).toContain("combat_result");
    expect(controllerOf(s.room, "battlefieldA")).toBe("p1");
    s.expectScore("p1", 1);
    expect(s.room.rules?.combat).toBe(null);
  });
});

describe("damage assignment prompt [R467.2.c][R411.2]", () => {
  it("[R467.2.c][R467.2.c.4] an open choice prompts the Attacker; invalid answers are rejected with the rule", () => {
    const s = attackScenario("Astral Heron", ["Treasure Hunter", "Clockwork Keeper"]);
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    s.expectPrompt("damage-assignment", "p1");
    const data = damageData(s.room)!;
    expect(data).toMatchObject({ reason: "combat.damage_assignment", battlefield: "battlefieldA", assignerId: "p1", total: 7 });
    expect(data.targets.map((target) => [target.objectId, target.lethal, target.tier])).toEqual([
      ["def-0", 1, 1],
      ["def-1", 2, 1],
    ]);
    expect(s.room.rules?.combat?.step).toBe("damage-assignment");
    const promptId = s.room.rules!.prompt!.id;

    s.as("p1").choose({ assignments: [{ targetId: "def-0", amount: 7 }] }).expectError("invalid_choice");
    expect(s.lastError()?.rule).toBe("467.2.c.3");
    s.as("p1").choose({ assignments: [{ targetId: "def-0", amount: 1 }, { targetId: "def-1", amount: 2 }] });
    expect(s.lastError()).toEqual({ code: "invalid_choice", rule: "467.2.c" });
    s.as("p1").choose({ assignments: [{ targetId: "atk-0", amount: 7 }] }).expectError("invalid_choice");
    s.as("p2").choose({ assignments: [{ targetId: "def-0", amount: 1 }, { targetId: "def-1", amount: 6 }] });
    expect(s.lastError()?.code).toBe("not_your_priority");
    expect(s.room.rules?.prompt?.id).toBe(promptId);

    s.as("p1").choose({ assignments: [{ targetId: "def-0", amount: 1 }, { targetId: "def-1", amount: 6 }] }).expectOk();
    const events = s.events();
    expect(events.find((event) => event.type === "damage_assigned" && event.playerId === "p1")?.data?.auto).toBe(false);
    // The Defender's assignment (3 into a 7-Might unit) is unique and made automatically.
    expect(events.find((event) => event.type === "damage_assigned" && event.playerId === "p2")?.data?.auto).toBe(true);
    expect(boardOf(s, "p2").trash.map((card) => card.id).sort()).toEqual(["def-0", "def-1"]);
    expect(controllerOf(s.room, "battlefieldA")).toBe("p1");
  });

  it("[R815.1.b][R815.1.c.1][R467.2.c.6] a Tank must be assigned lethal damage first (unique → automatic)", () => {
    const s = attackScenario("Stellacorn Herder", ["Stellacorn Herder", "Lecturing Yordle"], { p2: ["Lecturing Yordle"] });
    const events = passUntilSettled(s);
    const assigned = events.find((event) => event.type === "damage_assigned" && event.playerId === "p1");
    expect(assigned?.data?.auto).toBe(true);
    expect(assigned?.data?.assignments).toEqual([
      { targetId: "def-0", amount: 1 },
      { targetId: "def-1", amount: 2 },
    ]);
    expect(boardOf(s, "p2").trash.some((card) => card.id === "def-1")).toBe(true);
  });
});
