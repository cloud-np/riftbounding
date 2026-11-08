/**
 * Cleanups 318–324 with the battlefield control model — 188–190, 323.5–323.10.a, 462–464.
 */
import { describe, expect, it } from "vitest";
import type { GameVariant } from "@rift/protocol";
import { battlefieldController, combatParticipants, runCleanup } from "../../../src";
import { scenario } from "../../scenarios/dsl";
import { boardOf, controllerOf, eventTypes, passUntilSettled, placeUnit, setControl, stepOf, table } from "./helpers";

describe("control of battlefields [R190][R323.5]", () => {
  it("[R323.5][R190.4.c] a player without units loses control in an Open State", () => {
    const s = scenario();
    const unit = placeUnit(s, "p1", "Clockwork Keeper", "battlefieldA");
    setControl(s.room, "battlefieldA", "p1");
    expect(s.host.moveCard(s.room, "p1", "battlefieldA", "base", unit.id)).toBe(true);
    const step = stepOf(s);
    runCleanup(s.room, step);
    expect(controllerOf(s.room, "battlefieldA")).toBe(null);
    expect(step.events.find((event) => event.type === "lose_control")).toMatchObject({
      playerId: "p1",
      zone: "battlefieldA",
      data: { rule: "323.5" },
    });
  });

  it("[R323.5] control is kept while the turn is in a Closed State", () => {
    const s = scenario();
    const unit = placeUnit(s, "p1", "Clockwork Keeper", "battlefieldA");
    setControl(s.room, "battlefieldA", "p1");
    expect(s.host.moveCard(s.room, "p1", "battlefieldA", "base", unit.id)).toBe(true);
    s.room.rules!.chain.push({
      id: "closed-probe",
      kind: "card",
      status: "finalized",
      controller: "p1",
      choices: {},
      origin: "play",
    });
    runCleanup(s.room, stepOf(s));
    expect(controllerOf(s.room, "battlefieldA")).toBe("p1");
  });

  it("[R323.5][R190.4.b] control is kept while a Showdown is ongoing there", () => {
    const s = scenario();
    const unit = placeUnit(s, "p1", "Clockwork Keeper", "battlefieldA");
    setControl(s.room, "battlefieldA", "p1");
    s.room.rules!.showdown = { battlefield: "battlefieldA", kind: "non_combat", startedBy: "p2" };
    s.room.rules!.contested.battlefieldA = "p2";
    expect(s.host.moveCard(s.room, "p1", "battlefieldA", "base", unit.id)).toBe(true);
    runCleanup(s.room, stepOf(s));
    expect(controllerOf(s.room, "battlefieldA")).toBe("p1");
  });

  it("[R190.4.a] legacy rooms without a stored control state infer control from unit presence", () => {
    const s = scenario();
    placeUnit(s, "p2", "Clockwork Keeper", "battlefieldA");
    expect(battlefieldController(s.room, "battlefieldA", s.host)).toBe("p2");
    // 190.3.a: the Contested applier is never the inferred controller.
    s.room.rules!.contested.battlefieldA = "p2";
    expect(battlefieldController(s.room, "battlefieldA", s.host)).toBe(null);
  });

  it("[R190.3.a][R348.2.a][R348.2.a.1] a unit that becomes present at an Uncontrolled battlefield contests and conquers it", () => {
    const s = scenario({ battlefields: { p2: "Bandle Tree" } });
    setControl(s.room, "battlefieldB", null);
    placeUnit(s, "p1", "Clockwork Keeper", "battlefieldB", "arrival");
    const step = stepOf(s);
    runCleanup(s.room, step);
    expect(step.events.find((event) => event.type === "contested")).toMatchObject({
      playerId: "p1",
      zone: "battlefieldB",
      data: { rule: "190.3.a" },
    });
    expect(s.room.rules?.showdown).toMatchObject({ battlefield: "battlefieldB", kind: "non_combat" });
    passUntilSettled(s);
    expect(controllerOf(s.room, "battlefieldB")).toBe("p1");
    s.expectScore("p1", 1);
  });

  it("[R348.2.a] a non-combat Showdown won by the player who already controls the battlefield is no Conquer", () => {
    const s = scenario();
    placeUnit(s, "p2", "Clockwork Keeper", "battlefieldA");
    setControl(s.room, "battlefieldA", "p2");
    // p1 contested and its unit left during the Showdown; only p2's (the controller's) remain.
    s.room.rules!.contested.battlefieldA = "p1";
    s.room.rules!.showdown = { battlefield: "battlefieldA", kind: "non_combat", startedBy: "p1" };
    s.room.rules!.focus = "p1";
    s.room.rules!.priority = "p1";
    const events = passUntilSettled(s);
    expect(eventTypes(events)).toContain("showdown_end");
    expect(events.some((event) => event.type === "establish_control")).toBe(false);
    s.expectScore("p2", 0);
    expect(controllerOf(s.room, "battlefieldA")).toBe("p2");
  });
});

describe("323.6 recalls and hidden cards [R323.6][R323.6.a]", () => {
  it("[R323.6][R459.1] unattached non-Unit Gear and non-Unit Runes at battlefields are recalled; attached Gear stays", () => {
    const s = scenario();
    const unit = placeUnit(s, "p1", "Clockwork Keeper", "battlefieldA", "host-unit");
    setControl(s.room, "battlefieldA", "p1");
    placeUnit(s, "p1", "Blade of the Exile", "battlefieldA", "loose-gear");
    const attached = placeUnit(s, "p1", "Blade of the Exile", "battlefieldA", "worn-gear");
    attached.attachedToCardId = unit.id;
    const board = boardOf(s, "p1");
    const rune = board.runeDeck.shift()!;
    board.battlefieldA.push({ ...rune, id: "stray-rune" });
    runCleanup(s.room, stepOf(s));
    expect(board.base.map((card) => card.id)).toEqual(expect.arrayContaining(["loose-gear", "stray-rune"]));
    expect(board.battlefieldA.map((card) => card.id).sort()).toEqual(["host-unit", "worn-gear"]);
  });

  it("[R719.5][R149.3][R323.6] Gear attached to a unit that died detaches and is recalled in the same cleanup", () => {
    const s = scenario();
    const unit = placeUnit(s, "p1", "Clockwork Keeper", "battlefieldA", "doomed");
    setControl(s.room, "battlefieldA", "p1");
    const gear = placeUnit(s, "p1", "Blade of the Exile", "battlefieldA", "orphan-gear");
    gear.attachedToCardId = unit.id;
    s.room.rules!.objects[unit.id] = { damage: 5 };
    runCleanup(s.room, stepOf(s));
    const board = boardOf(s, "p1");
    expect(board.trash.some((card) => card.id === "doomed")).toBe(true);
    const recalled = board.base.find((card) => card.id === "orphan-gear");
    expect(recalled).toBeTruthy();
    expect(recalled?.attachedToCardId).toBeUndefined();
  });

  it("[R323.6.a] Hidden cards at a battlefield controlled by another player go to their owner's Trash", () => {
    const s = scenario();
    placeUnit(s, "p1", "Clockwork Keeper", "battlefieldA");
    setControl(s.room, "battlefieldA", "p1");
    const hidden = placeUnit(s, "p2", "Rebuke", "battlefieldA", "hidden-p2");
    hidden.hidden = true;
    const own = placeUnit(s, "p1", "Rebuke", "battlefieldA", "hidden-p1");
    own.hidden = true;
    const step = stepOf(s);
    runCleanup(s.room, step);
    expect(boardOf(s, "p2").trash.some((card) => card.id === "hidden-p2")).toBe(true);
    expect(boardOf(s, "p1").battlefieldA.some((card) => card.id === "hidden-p1")).toBe(true);
    expect(step.events.some((event) => event.type === "hidden_card_to_trash" && event.cardId === "hidden-p2")).toBe(true);
  });
});

describe("staging around an ongoing combat [R323.7][R323.8][R323.9][R462]", () => {
  it("[R323.7][R462][R344] a Showdown staged elsewhere waits for the Combat to end, then begins", () => {
    const s = scenario({ battlefields: { p2: "Bandle Tree" } });
    placeUnit(s, "p2", "Stellacorn Herder", "battlefieldA", "def");
    setControl(s.room, "battlefieldA", "p2");
    setControl(s.room, "battlefieldB", null);
    placeUnit(s, "p1", "Astral Heron", "base", "atk");
    s.as("p1").move("Astral Heron", "battlefieldA").expectOk();
    expect(s.room.rules?.combat?.battlefield).toBe("battlefieldA");
    // An effect puts a p1 unit at the Uncontrolled battlefieldB during the Combat Showdown.
    placeUnit(s, "p1", "Clockwork Keeper", "battlefieldB", "late");
    runCleanup(s.room, stepOf(s));
    expect(s.room.rules?.contested.battlefieldB).toBe("p1");
    expect(s.room.rules?.staged.showdowns).toContain("battlefieldB");
    expect(s.room.rules?.showdown?.battlefield).toBe("battlefieldA");
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    // Combat ended (p1 conquered A), then the 319.1 Cleanup opened the staged Showdown at B.
    expect(controllerOf(s.room, "battlefieldA")).toBe("p1");
    expect(s.room.rules?.combat).toBe(null);
    expect(s.room.rules?.showdown).toMatchObject({ battlefield: "battlefieldB", kind: "non_combat" });
    expect(s.room.rules?.focus).toBe("p1");
  });

  it("[R323.9] a staged Combat whose opposing units left is no longer staged", () => {
    const s = scenario();
    placeUnit(s, "p1", "Clockwork Keeper", "battlefieldA", "a");
    const other = placeUnit(s, "p2", "Clockwork Keeper", "battlefieldA", "b");
    s.room.rules!.staged.combats = ["battlefieldA"];
    s.room.rules!.contested.battlefieldA = "p1";
    expect(s.host.moveCard(s.room, "p2", "battlefieldA", "base", other.id)).toBe(true);
    s.room.rules!.chain.push({ id: "hold", kind: "card", status: "finalized", controller: "p1", choices: {}, origin: "play" });
    runCleanup(s.room, stepOf(s));
    expect(s.room.rules?.staged.combats).toEqual([]);
  });
});

describe("FFA combats [R464][R323.10.a]", () => {
  it("[R323.10.a][R303.2.a] several players without control: the first in Turn Order from the Turn Player applies Contested", () => {
    const t = table("free_for_all_3" as GameVariant);
    t.room.rules!.turn.player = "p3";
    t.place("p2", "Clockwork Keeper", "battlefieldB", "p2-unit");
    t.place("p1", "Clockwork Keeper", "battlefieldB", "p1-unit");
    setControl(t.room, "battlefieldB", null);
    t.room.rules!.contested.battlefieldB = "p3"; // p3's units left
    const step = t.step();
    runCleanup(t.room, step);
    expect(step.events.find((event) => event.type === "contested_reapplied")).toMatchObject({ playerId: "p1" });
    expect(t.room.rules?.combat).toMatchObject({ battlefield: "battlefieldB", attacker: "p1", defender: "p2" });
  });

  it("[R466.2.c.2][R464.3] with a third player present the battlefield's controller defends (RULES-QUESTION)", () => {
    const t = table("free_for_all_3" as GameVariant);
    t.place("p1", "Clockwork Keeper", "battlefieldC", "x1");
    t.place("p2", "Clockwork Keeper", "battlefieldC", "x2");
    t.place("p3", "Clockwork Keeper", "battlefieldC", "x3");
    setControl(t.room, "battlefieldC", "p3");
    t.room.rules!.contested.battlefieldC = "p1";
    expect(combatParticipants(t.room, "battlefieldC", t.host)).toEqual({ attacker: "p1", defender: "p3" });
  });

  it("[R463][R491] teammates sharing a battlefield never stage a Combat", () => {
    const t = table("teams_2v2" as GameVariant);
    // Implicit teams by seat parity: p1+p3 vs p2+p4.
    t.place("p1", "Clockwork Keeper", "battlefieldB", "ally-1");
    t.place("p3", "Clockwork Keeper", "battlefieldB", "ally-3");
    setControl(t.room, "battlefieldB", "p3");
    runCleanup(t.room, t.step());
    expect(t.room.rules?.combat).toBe(null);
    expect(t.room.rules?.staged.combats).toEqual([]);
    expect(t.room.rules?.contested.battlefieldB).toBeUndefined();
    expect(combatParticipants(t.room, "battlefieldB", t.host)).toBe(null);
  });
});
