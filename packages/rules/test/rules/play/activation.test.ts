import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RulesIntent } from "@rift/protocol";
import { explainIllegal, legalIntents, turnState } from "../../../src";
import { clearCardScripts, registerTestCardScript } from "../../../src/testing";
import * as fake from "./fake-effects";
import { bareScenario, boardOf, place, pool, runeState, setPool, setRunes, toHand } from "./helpers";
import type { RulesScenario } from "../../scenarios/dsl";

vi.mock("../../../src/cards/registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/cards/registry")>();
  const f = await import("./fake-effects");
  return {
    ...actual,
    listActivatedAbilities: (name: string | undefined | null, text?: string) =>
      f.fakeListActivated(name) ?? actual.listActivatedAbilities(name, text),
  };
});

beforeEach(() => fake.resetFakes());
afterEach(() => clearCardScripts());

function applyAndExplain(s: RulesScenario, player: string, intent: RulesIntent) {
  const explained = explainIllegal(s.room, player, intent, s.host);
  s.as(player).apply(intent);
  const error = s.lastError();
  expect(explained.ok, `explain=${JSON.stringify(explained)} apply=${JSON.stringify(error)}`).toBe(error === null);
  if (!explained.ok && error) expect({ code: explained.code, rule: explained.rule }).toEqual(error);
  return error;
}

/** A NEW-12 manual entry (what R2-effects' listActivatedAbilities returns for unscripted text). */
function manualEntry(text: string, n = 0) {
  return {
    ref: `manual:${n}`,
    manual: true,
    text,
    ability: { kind: "activated" as const, cost: {}, effect: { op: "custom" as const, id: "manual" as const } },
  };
}

describe("Basic Rune abilities [R164.2][R430]", () => {
  it("[R164.2.a][R430.2.a] [E]: Add [1] adds Energy at once and never moves Priority", () => {
    const s = bareScenario();
    const [rune] = setRunes(s, "p1", [{ domain: "Calm" }]);
    expect(legalIntents(s.room, "p1", s.host).activatable).toEqual(
      expect.arrayContaining([
        { objectId: rune, ability: "rune:exhaust" },
        { objectId: rune, ability: "rune:recycle" },
      ]),
    );
    s.as("p1").apply({ type: "rules_activate", objectId: rune!, ability: "rune:exhaust" }).expectOk();
    expect(pool(s, "p1").energy).toBe(1);
    expect(runeState(s, "p1", rune!)).toBe("exhausted");
    expect(s.room.rules?.chain).toEqual([]);
    expect(s.room.rules?.priority).toBe("p1");
    expect(s.events().map((event) => event.type)).toContain("add_resolved");
    // 415.4: an exhausted rune cannot pay [E] again.
    expect(applyAndExplain(s, "p1", { type: "rules_activate", objectId: rune!, ability: "rune:exhaust" })).toEqual({
      code: "insufficient_resources",
      rule: "415.4",
    });
  });

  it("[R164.2.b][R164.2.b.1][R417.1.b] Recycle this: Add [C] works on an exhausted rune", () => {
    const s = bareScenario();
    const [rune] = setRunes(s, "p1", [{ domain: "Chaos", exhausted: true }]);
    s.as("p1").apply({ type: "rules_activate", objectId: rune!, ability: "rune:recycle" }).expectOk();
    expect(pool(s, "p1").power).toEqual({ Chaos: 1 });
    expect(boardOf(s, "p1").runeDeck[0]?.id).toBe(rune);
  });

  it("[R430.3][EX:430.3] resources added before playing a card pay for it", () => {
    const s = bareScenario();
    const [a, b] = setRunes(s, "p1", [{ domain: "Chaos" }, { domain: "Chaos" }]);
    s.as("p1").apply({ type: "rules_activate", objectId: a!, ability: "rune:exhaust" }).expectOk();
    s.as("p1").apply({ type: "rules_activate", objectId: b!, ability: "rune:exhaust" }).expectOk();
    const card = toHand(s, "p1", "Treasure Hunter");
    s.as("p1").apply({ type: "rules_play", cardId: card.id, plan: { poolEnergy: 2 } }).expectOk();
    expect(pool(s, "p1").energy).toBe(0);
  });

  it("[R813.1.c.2][R309.1.a] rune abilities have Reaction: usable in a Closed State with Priority", () => {
    const s = bareScenario({ p1: { energy: 1 } });
    const [rune] = setRunes(s, "p1", [{ domain: "Calm" }]);
    registerTestCardScript({ name: "Gust", text: "test", status: "implemented", abilities: [{ kind: "spell", effect: { op: "seq", effects: [] } }] });
    const gust = toHand(s, "p1", "Gust");
    s.as("p1").apply({ type: "rules_play", cardId: gust.id, hold: true }).expectOk();
    expect(turnState(s.room)).toBe("neutral_closed");
    s.as("p1").apply({ type: "rules_activate", objectId: rune!, ability: "rune:exhaust" }).expectOk();
    expect(pool(s, "p1").energy).toBe(1);
    expect(s.room.rules?.chain).toHaveLength(1);
  });
});

describe("unscripted activated abilities resolve in the manual window [NEW-12][R377][§6.4]", () => {
  it("[R377.1][R415.5][EX:377.1] a manual ability pays its printed cost and opens the manual window on resolution", () => {
    const s = bareScenario({ p1: { energy: 2 } });
    const unit = place(s, "p1", "Stellacorn Herder", "base");
    fake.setActivated("Stellacorn Herder", [manualEntry("[2], [Tap]: Draw 1.")]);
    expect(legalIntents(s.room, "p1", s.host).activatable).toContainEqual({ objectId: unit.id, ability: "manual:0" });
    s.as("p1").apply({ type: "rules_activate", objectId: unit.id, ability: "manual:0" }).expectOk();
    expect(pool(s, "p1").energy).toBe(0);
    expect(s.host.isExhausted(s.room, unit.id)).toBe(true);
    expect(s.room.rules?.chain[0]).toMatchObject({ kind: "activated", abilityRef: "manual:0", status: "finalized" });
    s.as("p2").pass().expectOk();
    expect(s.room.rules?.manual).toMatchObject({ player: "p1" });
    s.as("p1").manualDone().expectOk();
    expect(s.room.rules?.chain).toEqual([]);
  });

  it("[R203.3][R377.1] a manual ability whose printed cost cannot be paid is not activatable", () => {
    const s = bareScenario({ p1: { energy: 1 } });
    const unit = place(s, "p1", "Stellacorn Herder", "base");
    fake.setActivated("Stellacorn Herder", [manualEntry("[2]: Draw 1.")]);
    expect(legalIntents(s.room, "p1", s.host).activatable).not.toContainEqual({ objectId: unit.id, ability: "manual:0" });
    expect(applyAndExplain(s, "p1", { type: "rules_activate", objectId: unit.id, ability: "manual:0" })?.code).toBe(
      "insufficient_resources",
    );
  });

  it("[R377.2.b][EX:377.2.b] “Use this ability only while I'm at a battlefield” is checked on activation", () => {
    const s = bareScenario({ extraCards: { p1: ["Ultrasoft Poro"] } });
    if (!s.handCard("p1", "Ultrasoft Poro")) toHand(s, "p1", "Ultrasoft Poro");
    const card = s.handCard("p1", "Ultrasoft Poro")!;
    s.host.moveCardTo(s.room, "p1", "hand", "base", card.id);
    fake.setActivated("Ultrasoft Poro", [manualEntry("[Tap]: Play two 1[Might] Bird unit tokens with [deflect].")]);
    expect(applyAndExplain(s, "p1", { type: "rules_activate", objectId: card.id, ability: "manual:0" })).toEqual({
      code: "illegal_action",
      rule: "377.2.b",
    });
    s.host.moveCardTo(s.room, "p1", "base", "battlefieldA", card.id);
    s.as("p1").apply({ type: "rules_activate", objectId: card.id, ability: "manual:0" }).expectOk();
  });

  it("[R204.1.b][EX:204.1.b] “[1] or [C]” offers alternative base costs; the controller chooses one", () => {
    const s = bareScenario({ p1: { energy: 0, power: { Calm: 1 } } });
    const unit = place(s, "p1", "Stellacorn Herder", "base");
    fake.setActivated("Stellacorn Herder", [manualEntry("[1] or [C]: Empower me.")]);
    // [1] is unaffordable; the first payable alternative ([C], a Calm card) is used by default.
    s.as("p1").apply({ type: "rules_activate", objectId: unit.id, ability: "manual:0", hold: true }).expectOk();
    expect(pool(s, "p1")).toEqual({ energy: 0, power: {} });
    const s2 = bareScenario({ p1: { energy: 1, power: { Calm: 1 } } });
    const unit2 = place(s2, "p1", "Stellacorn Herder", "base");
    expect(applyAndExplain(s2, "p1", { type: "rules_activate", objectId: unit2.id, ability: "manual:0", baseCost: 2 })).toEqual({
      code: "invalid_choice",
      rule: "204.1.b",
    });
    s2.as("p1").apply({ type: "rules_activate", objectId: unit2.id, ability: "manual:0", baseCost: 1, hold: true }).expectOk();
    expect(pool(s2, "p1")).toEqual({ energy: 1, power: {} });
  });

  it("[R430.2][R430.5] a printed “[Add]” ability adds its resources immediately", () => {
    const s = bareScenario();
    const gear = place(s, "p1", "Blade of the Exile", "base");
    fake.setActivated("Blade of the Exile", [
      { ...manualEntry("Kill this, [Tap]: [Reaction] – [Add] [Rune]."), ability: { kind: "activated", cost: {}, effect: { op: "custom", id: "manual" }, addsResources: true } },
    ]);
    s.as("p1").apply({ type: "rules_activate", objectId: gear.id, ability: "manual:0" }).expectOk();
    expect(pool(s, "p1").power).toEqual({ any: 1 });
    expect(s.host.findCard(s.room, gear.id)?.zone).toBe("trash");
    expect(s.room.rules?.priority).toBe("p1");
  });
});

describe("activation timing and limits [R381][R145.2][R376]", () => {
  it("[R381.1][R145.2] without Action/Reaction an ability is activated only on its controller's turn in an Open State", () => {
    const s = bareScenario({ p2: { energy: 2 } });
    const unit = place(s, "p2", "Stellacorn Herder", "base");
    fake.setActivated("Stellacorn Herder", [manualEntry("[2]: Draw 1.")]);
    expect(applyAndExplain(s, "p2", { type: "rules_activate", objectId: unit.id, ability: "manual:0" })?.code).toBe(
      "not_your_priority",
    );
  });

  it("[R806.1.c.2] an ability with Action may be activated in a Showdown Open State", () => {
    const s = bareScenario({ p1: { energy: 2 } });
    const unit = place(s, "p1", "Stellacorn Herder", "battlefieldA");
    s.room.rules!.showdown = { battlefield: "battlefieldA", kind: "non_combat", startedBy: "p1" };
    s.room.rules!.focus = "p1";
    fake.setActivated("Stellacorn Herder", [manualEntry("[2]: Draw 1."), manualEntry("[Action] [2]: Draw 1.", 1)]);
    expect(applyAndExplain(s, "p1", { type: "rules_activate", objectId: unit.id, ability: "manual:0" })).toEqual({
      code: "showdown_requires_action",
      rule: "308.1.a",
    });
    s.as("p1").apply({ type: "rules_activate", objectId: unit.id, ability: "manual:1", hold: true }).expectOk();
  });

  it("[R376][Limit] a once-per-turn ability cannot be activated twice in a turn", () => {
    const s = bareScenario();
    const unit = place(s, "p1", "Stellacorn Herder", "base");
    registerTestCardScript({
      name: "Stellacorn Herder",
      text: "test",
      status: "implemented",
      abilities: [{ kind: "activated", cost: {}, effect: { op: "seq", effects: [] }, limit: { kind: "once-per-turn" } }],
    });
    s.as("p1").apply({ type: "rules_activate", objectId: unit.id, ability: "activated:0" }).expectOk();
    s.as("p2").pass().expectOk();
    expect(applyAndExplain(s, "p1", { type: "rules_activate", objectId: unit.id, ability: "activated:0" })).toEqual({
      code: "illegal_action",
      rule: "376",
    });
  });
});

describe("Equip [R818]", () => {
  it("[R818.1.c.2][R818.1.b.1] Equip targets a unit you control and pays one of its base costs", () => {
    const s = bareScenario({ p1: { power: { Chaos: 1 } } });
    const gear = place(s, "p1", "Blade of the Exile", "base");
    const unit = place(s, "p1", "Treasure Hunter", "base");
    expect(legalIntents(s.room, "p1", s.host).activatable).toContainEqual({ objectId: gear.id, ability: "equip:0" });
    s.as("p1").apply({ type: "rules_activate", objectId: gear.id, ability: "equip:0", hold: true }).expectOk();
    // One friendly unit: the target is forced (411.2); [A] is paid with the Chaos Power.
    expect(s.room.rules?.chain[0]).toMatchObject({ abilityRef: "equip:0", choices: { "target:0": unit.id } });
    expect(pool(s, "p1").power).toEqual({});
  });

  it("[R818.1.c.3][R204.1.b] “[Rune] or exhaust a friendly unit”: without Power the unit-exhaust alternative pays", () => {
    const s = bareScenario();
    const gear = place(s, "p1", "Blade of the Exile", "base");
    const unit = place(s, "p1", "Treasure Hunter", "base");
    s.as("p1").apply({ type: "rules_activate", objectId: gear.id, ability: "equip:0", hold: true }).expectOk();
    expect(s.host.isExhausted(s.room, unit.id)).toBe(true);
  });

  it("[R818.1.b.1][R411.2] with several friendly units the Equip target is prompted", () => {
    const s = bareScenario({ p1: { power: { Calm: 1 } } });
    const gear = place(s, "p1", "Blade of the Exile", "base");
    const a = place(s, "p1", "Treasure Hunter", "base");
    place(s, "p1", "Stellacorn Herder", "base");
    s.as("p1").apply({ type: "rules_activate", objectId: gear.id, ability: "equip:0" }).expectOk();
    expect(s.room.rules?.prompt).toMatchObject({ kind: "choose-target", rule: "818.1.b.1" });
    s.as("p1").choose({ optionIds: [a.id] }).expectOk();
    expect(s.room.rules?.chain[0]).toMatchObject({ choices: { "target:0": a.id }, status: "finalized" });
    expect(pool(s, "p1").power).toEqual({});
    setPool(s, "p1", 0);
  });
});
