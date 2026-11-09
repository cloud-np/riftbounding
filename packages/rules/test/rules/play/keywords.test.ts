import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RulesIntent } from "@rift/protocol";
import { explainIllegal, legalIntents, turnState } from "../../../src";
import { clearCardScripts, registerTestCardScript } from "../../../src/testing";
import { legionActive, weaponmasterEquipCosts } from "../../../src/play/keyword-helpers";
import { parseCardKeywords, printedCardKeywords } from "../../../src/play/keywords";
import { snapshotInfo } from "../../../src/play/card-info";
import * as fake from "./fake-effects";
import { bareScenario, boardOf, place, pool, setPool, toHand } from "./helpers";
import type { RulesScenario } from "../../scenarios/dsl";

vi.mock("../../../src/effects/choices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/effects/choices")>();
  const f = await import("./fake-effects");
  return { ...actual, requiredChoices: f.requiredChoices, validateChoices: f.validateChoices };
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

function noopSpell(name: string) {
  registerTestCardScript({ name, text: "test", status: "implemented", abilities: [{ kind: "spell", effect: { op: "seq", effects: [] } }] });
}

/** Hide `name` for p1 at battlefieldA (p1 controls it) and pretend it was an earlier turn. */
function hiddenAtA(s: RulesScenario, name: string) {
  place(s, "p1", "Stellacorn Herder", "battlefieldA");
  const card = s.handCard("p1", name) ?? toHand(s, "p1", name);
  setPool(s, "p1", 0, { any: 1 });
  s.as("p1").apply({ type: "rules_play", cardId: card.id, hide: true, location: "battlefieldA" }).expectOk();
  s.room.rules!.objects[card.id]!.hiddenTurn = s.room.rules!.turn.number - 1;
  return card;
}

describe("card-level keywords [R135.2.d.3][R135.2.e.7][R819.1.b]", () => {
  it("[R135.2.d.3] reminder-text keywords are not card keywords (Reckless Innovator has no Reaction)", () => {
    const info = snapshotInfo({ id: "x", name: "Reckless Innovator", source: "mainDeck", exhausted: false, createdAt: 0 });
    expect(info.keywords).toContain("Reaction"); // the catalog's extraction artifact
    expect(printedCardKeywords(info)).toEqual(["Accelerate"]);
  });

  it("[R135.2.e.7] a permission on an activated ability is the ability's, not the card's", () => {
    expect(parseCardKeywords("[Tap]: [REACTION] - [ADD] [Fury].")).toEqual([]);
    expect(parseCardKeywords("[Action]  Exhaust a unit you control, [tap] : Move a unit.")).toEqual([]);
    expect(parseCardKeywords("[REACTION] (Play any time.)\nCounter a spell.")).toEqual(["Reaction"]);
    expect(parseCardKeywords("[DEFLECT 2] (Opponents must pay.)")).toEqual(["Deflect 2"]);
  });

  it("[R819.1.b] Quick-Draw cards have Reaction inherently and can be played in a Closed State", () => {
    const s = bareScenario({ p1: { energy: 3, power: { Fury: 1 } }, extraCards: { p1: ["Long Sword"] } });
    noopSpell("Gust");
    const gust = toHand(s, "p1", "Gust");
    const sword = s.handCard("p1", "Long Sword") ?? toHand(s, "p1", "Long Sword");
    s.as("p1").apply({ type: "rules_play", cardId: gust.id, hold: true }).expectOk();
    expect(turnState(s.room)).toBe("neutral_closed");
    s.as("p1").apply({ type: "rules_play", cardId: sword.id, hold: true }).expectOk();
  });
});

describe("Hidden [R811][R422]", () => {
  it("[R811.1.b][R811.1.c.2][R422.1] hiding pays [A], puts the card facedown and opens no chain", () => {
    const s = bareScenario({ p1: { power: { Calm: 1 } }, extraCards: { p1: ["Stand United"] } });
    place(s, "p1", "Stellacorn Herder", "battlefieldA");
    const card = s.handCard("p1", "Stand United") ?? toHand(s, "p1", "Stand United");
    expect(legalIntents(s.room, "p1", s.host).hideable).toEqual([{ cardId: card.id, locations: ["battlefieldA"] }]);
    s.as("p1").apply({ type: "rules_play", cardId: card.id, hide: true, location: "battlefieldA" }).expectOk();
    const hidden = boardOf(s, "p1").battlefieldA.find((entry) => entry.id === card.id);
    expect(hidden?.hidden).toBe(true);
    expect(s.room.rules?.chain).toEqual([]);
    expect(s.room.rules?.priority).toBe("p1");
    expect(pool(s, "p1").power).toEqual({});
    expect(s.room.rules?.history.cardsPlayedThisTurn.p1 ?? 0).toBe(0);
  });

  it("[R811.1.b][R107.3.b][R422.1] hiding needs Hidden, a controlled battlefield with an empty Facedown Zone", () => {
    const s = bareScenario({ p1: { power: { Calm: 2 } }, extraCards: { p1: ["Stand United", "Zhonya's Hourglass"] } });
    const stand = s.handCard("p1", "Stand United") ?? toHand(s, "p1", "Stand United");
    const zhonya = s.handCard("p1", "Zhonya's Hourglass") ?? toHand(s, "p1", "Zhonya's Hourglass");
    const plain = toHand(s, "p1", "Treasure Hunter");
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: stand.id, hide: true, location: "battlefieldA" })).toEqual({
      code: "invalid_location",
      rule: "422.1",
    });
    place(s, "p1", "Stellacorn Herder", "battlefieldA");
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: plain.id, hide: true, location: "battlefieldA" })).toEqual({
      code: "illegal_action",
      rule: "811.1",
    });
    s.as("p1").apply({ type: "rules_play", cardId: stand.id, hide: true, location: "battlefieldA" }).expectOk();
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: zhonya.id, hide: true, location: "battlefieldA" })).toEqual({
      code: "invalid_location",
      rule: "107.3.b",
    });
  });

  it("[R811.1.b] hiding is only possible on your own turn", () => {
    const s = bareScenario({ p2: { power: { Calm: 1 } }, extraCards: { p2: ["Stand United"] } });
    place(s, "p2", "Caitlyn, Patrolling", "battlefieldB");
    const card = s.handCard("p2", "Stand United") ?? toHand(s, "p2", "Stand United");
    expect(applyAndExplain(s, "p2", { type: "rules_play", cardId: card.id, hide: true, location: "battlefieldB" })?.code).toBe(
      "not_your_priority",
    );
  });

  it("[R811.6][R811.1.b][R356.1.b] from the next turn a hidden card has Reaction and ignores its base cost", () => {
    const s = bareScenario({ extraCards: { p1: ["Stand United"] } });
    noopSpell("Stand United");
    noopSpell("Gust");
    const card = hiddenAtA(s, "Stand United");
    setPool(s, "p1", 1);
    const gust = toHand(s, "p1", "Gust");
    s.as("p1").apply({ type: "rules_play", cardId: gust.id, hold: true }).expectOk();
    expect(turnState(s.room)).toBe("neutral_closed");
    s.as("p1").apply({ type: "rules_play", cardId: card.id, hold: true }).expectOk();
    expect(s.room.rules?.chain.map((item) => item.cardName)).toEqual(["Gust", "Stand United"]);
    expect(s.room.rules?.chain[1]?.playedFromFacedown).toBe("battlefieldA");
    expect(s.room.rules?.chain[1]?.cardSnapshot?.hidden).toBeUndefined();
  });

  it("[R811.1.b] a card hidden this turn cannot be played from facedown yet", () => {
    const s = bareScenario({ p1: { power: { any: 1 }, energy: 3 }, extraCards: { p1: ["Stand United"] } });
    place(s, "p1", "Stellacorn Herder", "battlefieldA");
    const card = s.handCard("p1", "Stand United") ?? toHand(s, "p1", "Stand United");
    s.as("p1").apply({ type: "rules_play", cardId: card.id, hide: true, location: "battlefieldA" }).expectOk();
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: card.id })).toEqual({ code: "not_in_hand", rule: "420.1.a" });
    expect(legalIntents(s.room, "p1", s.host).playableCardIds).not.toContain(card.id);
  });

  it("[R811.1.d.1][R811.1.d.1.a] a hidden permanent must be played to its battlefield (gear included)", () => {
    const s = bareScenario({ extraCards: { p1: ["Zhonya's Hourglass"] } });
    const card = hiddenAtA(s, "Zhonya's Hourglass");
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: card.id, location: "base" })).toEqual({
      code: "invalid_location",
      rule: "811.1.d.1.a",
    });
    const detail = legalIntents(s.room, "p1", s.host).playable?.find((entry) => entry.cardId === card.id);
    expect(detail).toMatchObject({ locations: ["battlefieldA"], fromFacedown: true, cost: { energy: 0, power: 0 } });
    s.as("p1").apply({ type: "rules_play", cardId: card.id }).expectOk();
    // 359.2.d/811.1.d.1.a: it enters at the battlefield it was hidden at, face up …
    expect(s.events().find((event) => event.type === "gear_played")).toMatchObject({ cardId: card.id, zone: "battlefieldA" });
    // … and, as unattached non-Unit Gear without Deploy, the next Cleanup recalls it (459.1/149.3;
    // today the engine host's victory settle performs that recall without a `recall` event).
    expect(boardOf(s, "p1").base.some((entry) => entry.id === card.id && !entry.hidden)).toBe(true);
  });

  it("[R811.1.d.2][EX:811.1.d.2] a spell played from facedown chooses its targets at that battlefield", () => {
    const s = bareScenario({ extraCards: { p1: ["Stand United"] } });
    const card = hiddenAtA(s, "Stand United");
    const here = boardOf(s, "p1").battlefieldA[0]!;
    const elsewhere = place(s, "p1", "Treasure Hunter", "base");
    registerTestCardScript({ name: "Stand United", text: "test", status: "implemented", abilities: [fake.fakeAbility("Stand United")] });
    fake.setSpecs("Stand United", (room, host) => [fake.anyUnitSpec(room, host)]);
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: card.id, targets: [elsewhere.id] })?.code).toBe("illegal_target");
    // The only unit at the battlefield is forced (411.2).
    s.as("p1").apply({ type: "rules_play", cardId: card.id, hold: true }).expectOk();
    expect(s.room.rules?.chain[0]?.choices["target:0"]).toBe(here.id);
  });

  it("[R811.1.d.4][EX:811.1.d.4] a choice whose text makes the battlefield restriction impossible is unrestricted", () => {
    const s = bareScenario({ extraCards: { p1: ["Stand United"] } });
    const card = hiddenAtA(s, "Stand United");
    const elsewhere = place(s, "p1", "Treasure Hunter", "base");
    registerTestCardScript({ name: "Stand United", text: "test", status: "implemented", abilities: [fake.fakeAbility("Stand United")] });
    fake.setSpecs("Stand United", (room, host) => [
      fake.anyUnitSpec(room, host),
      { ...fake.anyUnitSpec(room, host, { key: "target:1" }), data: { hiddenUnrestricted: true } },
    ]);
    const here = boardOf(s, "p1").battlefieldA[0]!;
    s.as("p1").apply({ type: "rules_play", cardId: card.id, hold: true, targets: [here.id, elsewhere.id] }).expectOk();
  });
});

describe("Hidden undo [R358.5][R811.1.b]", () => {
  it("[R358.5][R811.1.b] a facedown play undone after its prompt goes back facedown and stays playable", () => {
    const s = bareScenario({ extraCards: { p1: ["Stand United"] } });
    const card = hiddenAtA(s, "Stand United");
    const here = boardOf(s, "p1").battlefieldA.find((entry) => !entry.hidden)!;
    const deflect = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects[deflect.id] = { grantedKeywords: ["Deflect"] };
    registerTestCardScript({ name: "Stand United", text: "test", status: "implemented", abilities: [fake.fakeAbility("Stand United")] });
    fake.setSpecs("Stand United", (room, host) => [fake.anyUnitSpec(room, host)]);
    setPool(s, "p1", 0);
    s.as("p1").apply({ type: "rules_play", cardId: card.id }).expectOk();
    // Choosing the Deflect unit costs [A] the player cannot pay: the play is undone (358.5).
    s.as("p1").choose({ optionIds: [deflect.id] }).expectOk();
    expect(s.events().map((event) => event.type)).toContain("play_cancelled");
    const back = boardOf(s, "p1").battlefieldA.find((entry) => entry.id === card.id);
    expect(back?.hidden).toBe(true);
    expect(legalIntents(s.room, "p1", s.host).playableCardIds).toContain(card.id);
    s.as("p1").apply({ type: "rules_play", cardId: card.id, targets: [here.id], hold: true }).expectOk();
    expect(s.room.rules?.objects[card.id]?.hiddenTurn).toBeUndefined();
  });
});

describe("Ambush [R822]", () => {
  it("[R822.1.b][R822.1.c] Ambush adds battlefields where you have Units, with Reaction there", () => {
    const s = bareScenario({ p1: { energy: 3 }, extraCards: { p1: ["Inferna"] } });
    noopSpell("Gust");
    const mine = place(s, "p1", "Stellacorn Herder", "battlefieldA");
    place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.contested.battlefieldA = "p1"; // P1 does not control it (190.3.b)
    const inferna = s.handCard("p1", "Inferna") ?? toHand(s, "p1", "Inferna");
    const gust = toHand(s, "p1", "Gust");
    s.as("p1").apply({ type: "rules_play", cardId: gust.id, hold: true }).expectOk();
    // Closed State: Reaction only through Ambush, i.e. only to the battlefield with P1's units.
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: inferna.id })).toEqual({
      code: "closed_state_requires_reaction",
      rule: "309.1.a",
    });
    s.as("p1").apply({ type: "rules_play", cardId: inferna.id, location: "battlefieldA", hold: true }).expectOk();
    expect(boardOf(s, "p1").battlefieldA.some((entry) => entry.id === inferna.id)).toBe(true);
    expect(mine.id).toBeTruthy();
  });

  it("[R822.3] without Units at the battlefield Ambush gives no permission there", () => {
    const s = bareScenario({ p1: { energy: 2 }, extraCards: { p1: ["Inferna"] } });
    const inferna = s.handCard("p1", "Inferna") ?? toHand(s, "p1", "Inferna");
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: inferna.id, location: "battlefieldA" })).toEqual({
      code: "invalid_location",
      rule: "355.2.a",
    });
  });
});

describe("Deploy [R830]", () => {
  it("[R830.1.b][R830.1.b.1] Deploy gear is played only to a battlefield, any battlefield", () => {
    const s = bareScenario({ p1: { energy: 1, power: { Fury: 1 } }, extraCards: { p1: ["Banner of Conquest"] } });
    place(s, "p2", "Caitlyn, Patrolling", "battlefieldB");
    const banner = s.handCard("p1", "Banner of Conquest") ?? toHand(s, "p1", "Banner of Conquest");
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: banner.id, location: "base" })).toEqual({
      code: "invalid_location",
      rule: "830.1.b",
    });
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: banner.id })).toEqual({
      code: "invalid_location",
      rule: "830.1.b",
    });
    const detail = legalIntents(s.room, "p1", s.host).playable?.find((entry) => entry.cardId === banner.id);
    expect(detail?.locations).toEqual(s.host.battlefieldZones(s.room));
    s.as("p1").apply({ type: "rules_play", cardId: banner.id, location: "battlefieldB" }).expectOk();
    // 359.2.d / 830.1.b.1: it enters at the chosen battlefield (an enemy-occupied one here).
    // TODO(R2-play): R2-combat's cleanup step 5 must not recall Deploy gear (830.1.b.3); until
    // then the following Cleanup moves it back, so only the entry is asserted.
    expect(s.events().find((event) => event.type === "gear_played")).toMatchObject({ cardId: banner.id, zone: "battlefieldB" });
  });
});

describe("Legion, Repeat, Weaponmaster, Ganking [R812][R820][R821][R810]", () => {
  it("[R812.1.c][R812.2][EX:812.2] Legion is active once another card was finalized this turn", () => {
    const s = bareScenario({ p1: { energy: 4 } });
    const first = toHand(s, "p1", "Treasure Hunter");
    const second = toHand(s, "p1", "Treasure Hunter");
    expect(legionActive(s.room, "p1", second.id)).toBe(false);
    s.as("p1").apply({ type: "rules_play", cardId: first.id }).expectOk();
    expect(legionActive(s.room, "p1", second.id)).toBe(true);
    expect(legionActive(s.room, "p1", first.id)).toBe(false);
    expect(legionActive(s.room, "p2")).toBe(false);
  });

  it("[R820.1.c][R820.1.d][EX:820.1.d.1] Repeat is an optional additional cost recorded for the second execution", () => {
    const s = bareScenario({ p1: { energy: 4 }, extraCards: { p1: ["Desert's Call"] } });
    const call = s.handCard("p1", "Desert's Call") ?? toHand(s, "p1", "Desert's Call");
    expect(legalIntents(s.room, "p1", s.host).playable?.find((entry) => entry.cardId === call.id)?.optionalCosts).toEqual(["repeat"]);
    s.as("p1").apply({ type: "rules_play", cardId: call.id, optionalCosts: ["repeat"], hold: true }).expectOk();
    expect(pool(s, "p1").energy).toBe(0);
    expect(s.room.rules?.chain[0]).toMatchObject({ optionalCosts: ["repeat"], choices: { "cost:repeat": true } });
  });

  it("[R820.1.c.3] each Repeat cost can be paid only once", () => {
    const s = bareScenario({ p1: { energy: 6 }, extraCards: { p1: ["Desert's Call"] } });
    const call = s.handCard("p1", "Desert's Call") ?? toHand(s, "p1", "Desert's Call");
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: call.id, optionalCosts: ["repeat", "repeat"] })).toEqual({
      code: "invalid_choice",
      rule: "820.1.c.3",
    });
  });

  it("[R821.1.c][R821.1.c.3][R821.1.c.4] Weaponmaster's Equip cost is reduced by [A] only", () => {
    const s = bareScenario({ extraCards: { p1: ["Spinning Axe", "Long Sword"] } });
    const axe = place(s, "p1", "Spinning Axe", "base");
    const sword = place(s, "p1", "Long Sword", "base");
    const blade = place(s, "p1", "Blade of the Exile", "base");
    const unit = place(s, "p1", "Treasure Hunter", "base");
    expect(weaponmasterEquipCosts(s.room, s.host, axe.id)).toEqual([{}]);
    expect(weaponmasterEquipCosts(s.room, s.host, sword.id)).toEqual([{ power: { Fury: 1 } }]);
    expect(weaponmasterEquipCosts(s.room, s.host, blade.id)).toEqual([{}, { exhaust: { cardType: "unit", controller: "self" } }]);
    expect(weaponmasterEquipCosts(s.room, s.host, unit.id)).toBe(null);
  });

  it("[R810.1.b][R810.3] a granted Ganking lets a Unit move battlefield to battlefield", () => {
    const s = bareScenario();
    const unit = place(s, "p1", "Stellacorn Herder", "battlefieldA");
    const intent: RulesIntent = { type: "rules_move", unitIds: [unit.id], to: "battlefieldB" };
    expect(applyAndExplain(s, "p1", intent)).toEqual({ code: "invalid_location", rule: "144.4.c" });
    s.room.rules!.objects[unit.id] = { grantedKeywords: ["Ganking"] };
    expect(legalIntents(s.room, "p1", s.host).moves).toContainEqual({ unitIds: [unit.id], to: "battlefieldB" });
    s.as("p1").apply(intent).expectOk();
  });
});
