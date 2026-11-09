import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RulesIntent } from "@rift/protocol";
import { explainIllegal, legalIntents, registerActionInterceptor, turnState, whoMayAct } from "../../../src";
import { clearCardScripts, registerTestCardScript } from "../../../src/testing";
import * as fake from "./fake-effects";
import { bareScenario, boardOf, place, pool, runeState, setPool, setRunes, toHand } from "./helpers";
import type { RulesScenario } from "../../scenarios/dsl";

vi.mock("../../../src/effects/choices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/effects/choices")>();
  const f = await import("./fake-effects");
  return { ...actual, requiredChoices: f.requiredChoices, validateChoices: f.validateChoices };
});
vi.mock("../../../src/layers/costs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/layers/costs")>();
  const f = await import("./fake-effects");
  return { ...actual, costAdjustments: f.costAdjustments };
});
vi.mock("../../../src/layers/restrictions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/layers/restrictions")>();
  const f = await import("./fake-effects");
  return { ...actual, restrictionFor: f.restrictionFor };
});

beforeEach(() => fake.resetFakes());
afterEach(() => clearCardScripts());

/** Apply and explain the same intent; both must agree (F5–F7). */
function applyAndExplain(s: RulesScenario, player: string, intent: RulesIntent) {
  const explained = explainIllegal(s.room, player, intent, s.host);
  s.as(player).apply(intent);
  const error = s.lastError();
  expect(explained.ok, `explain=${JSON.stringify(explained)} apply=${JSON.stringify(error)}`).toBe(error === null);
  if (!explained.ok && error) {
    expect(explained.code).toBe(error.code);
    expect(explained.rule).toBe(error.rule);
  }
  return { explained, error };
}

function registerTargetSpell(name: string, specs: Parameters<typeof fake.setSpecs>[1]) {
  registerTestCardScript({ name, text: "test", status: "implemented", abilities: [fake.fakeAbility(name)] });
  fake.setSpecs(name, specs);
}

describe("play permission and source zone [R354][R420.1.a]", () => {
  it("[R420.1.a][R354] a card can be played from hand, never from the deck or the trash", () => {
    const s = bareScenario({ p1: { energy: 2 } });
    const deckCard = boardOf(s, "p1").deck.find((card) => card.name === "Treasure Hunter")!;
    let result = applyAndExplain(s, "p1", { type: "rules_play", cardId: deckCard.id });
    expect(result.error).toEqual({ code: "not_in_hand", rule: "420.1.a" });
    const trashed = toHand(s, "p1", "Treasure Hunter");
    s.host.moveCardTo(s.room, "p1", "hand", "trash", trashed.id);
    result = applyAndExplain(s, "p1", { type: "rules_play", cardId: trashed.id });
    expect(result.error?.code).toBe("not_in_hand");
    expect(s.room.rules?.chain).toEqual([]);
  });

  it("[R420.1.a] an opponent's hand card is not playable", () => {
    const s = bareScenario({ p1: { energy: 5 } });
    const card = toHand(s, "p2", "Treasure Hunter");
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: card.id }).error?.code).toBe("not_in_hand");
  });
});

describe("costs are paid in the process of play [R356][R357][R420.2.a]", () => {
  it("[R357][R420.2.a] an unaffordable card is rejected before it moves and is not listed", () => {
    const s = bareScenario({ p1: { energy: 1 } });
    const card = toHand(s, "p1", "Treasure Hunter");
    const before = JSON.stringify(s.room);
    const result = applyAndExplain(s, "p1", { type: "rules_play", cardId: card.id });
    expect(result.error?.code).toBe("insufficient_resources");
    expect(JSON.stringify(s.room)).toBe(before);
    expect(legalIntents(s.room, "p1", s.host).playableCardIds).not.toContain(card.id);
    setPool(s, "p1", 2);
    expect(legalIntents(s.room, "p1", s.host).playableCardIds).toContain(card.id);
  });

  it("[R357.1][R164.2.a][R359.2.c] runes are exhausted to pay and the Unit enters exhausted at its Location", () => {
    const s = bareScenario();
    const [a, b, c] = setRunes(s, "p1", [{ domain: "Chaos" }, { domain: "Chaos" }, { domain: "Calm" }]);
    const card = toHand(s, "p1", "Treasure Hunter");
    s.as("p1").apply({ type: "rules_play", cardId: card.id }).expectOk();
    expect([runeState(s, "p1", a!), runeState(s, "p1", b!), runeState(s, "p1", c!)].filter((x) => x === "exhausted")).toHaveLength(2);
    const unit = boardOf(s, "p1").base.find((entry) => entry.id === card.id);
    expect(unit?.exhausted).toBe(true);
    expect(s.events().map((event) => event.type)).toEqual(expect.arrayContaining(["cost_paid", "card_played", "unit_played"]));
  });

  it("[R359.2.d][R149.1][R135.2.e.6.c] gear pays [C] with either of its Domains and enters ready at the Base", () => {
    const s = bareScenario({ p1: { energy: 3 } });
    setRunes(s, "p1", [{ domain: "Chaos", exhausted: true }]);
    const card = toHand(s, "p1", "Blade of the Exile");
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: card.id, location: "battlefieldA" }).error).toEqual({
      code: "invalid_location",
      rule: "359.2.d",
    });
    s.as("p1").apply({ type: "rules_play", cardId: card.id }).expectOk();
    expect(boardOf(s, "p1").base.find((entry) => entry.id === card.id)?.exhausted).toBe(false);
    expect(pool(s, "p1")).toEqual({ energy: 0, power: {} });
  });

  it("[R357.1] an explicit payment plan must pay exactly with sources the player has", () => {
    const s = bareScenario({ p1: { energy: 1 } });
    const [rune] = setRunes(s, "p1", [{ domain: "Calm" }]);
    const card = toHand(s, "p1", "Treasure Hunter");
    let result = applyAndExplain(s, "p1", { type: "rules_play", cardId: card.id, plan: { poolEnergy: 2 } });
    expect(result.error).toEqual({ code: "invalid_payment", rule: "166" });
    result = applyAndExplain(s, "p1", { type: "rules_play", cardId: card.id, plan: { exhaustRunes: [rune!] } });
    expect(result.error).toEqual({ code: "invalid_payment", rule: "357.1" });
    s.as("p1").apply({ type: "rules_play", cardId: card.id, plan: { poolEnergy: 1, exhaustRunes: [rune!] } }).expectOk();
    expect(runeState(s, "p1", rune!)).toBe("exhausted");
  });

  it("[R356.3][R356.4][R356.6] cost increases and discounts from the cost layer apply, never below 0", () => {
    const s = bareScenario({ p1: { energy: 1 } });
    const card = toHand(s, "p1", "Treasure Hunter");
    fake.addAdjustment((_room, _host, query) => (query.cardId === card.id ? [{ energy: -5, rule: "356.4" }] : []));
    s.as("p1").apply({ type: "rules_play", cardId: card.id }).expectOk();
    expect(pool(s, "p1").energy).toBe(1); // 2 - 5 → 0 (356.6): nothing was paid.
    expect(fake.calls.costAdjustments.some((query) => query.cardId === card.id && query.playerId === "p1")).toBe(true);
    fake.resetFakes();
    const s2 = bareScenario({ p1: { energy: 2 } });
    const card2 = toHand(s2, "p1", "Treasure Hunter");
    fake.addAdjustment((_room, _host, query) => (query.cardId === card2.id ? [{ energy: 1, rule: "356.3" }] : []));
    expect(applyAndExplain(s2, "p1", { type: "rules_play", cardId: card2.id }).error?.code).toBe("insufficient_resources");
  });
});

describe("Locations [R355.2][R451.2][R355.17.b]", () => {
  it("[R355.2.a] a Unit may enter the Base or a Battlefield its controller controls only", () => {
    const s = bareScenario({ p1: { energy: 6 } });
    const first = toHand(s, "p1", "Treasure Hunter");
    let result = applyAndExplain(s, "p1", { type: "rules_play", cardId: first.id, location: "battlefieldA" });
    expect(result.error).toEqual({ code: "invalid_location", rule: "355.2.a" });
    place(s, "p1", "Stellacorn Herder", "battlefieldA");
    s.as("p1").apply({ type: "rules_play", cardId: first.id, location: "battlefieldA" }).expectOk();
    expect(boardOf(s, "p1").battlefieldA.some((entry) => entry.id === first.id)).toBe(true);
  });

  it("[R190.3.b][R355.2.a] a Battlefield the player only contests during a Showdown is not controlled", () => {
    const s = bareScenario({ p1: { energy: 2 } });
    place(s, "p1", "Stellacorn Herder", "battlefieldA");
    place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.contested.battlefieldA = "p1";
    const card = toHand(s, "p1", "Treasure Hunter");
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: card.id, location: "battlefieldA" }).error?.code).toBe(
      "invalid_location",
    );
  });

  it("[R355.17.b][EX:355.17.b] a restriction on where a card can be played makes it fail to finalize", () => {
    // Perched Grimwyrm: "Play me only to a battlefield you conquered this turn" (none conquered).
    const s = bareScenario({ p1: { energy: 2 } });
    place(s, "p1", "Stellacorn Herder", "battlefieldA");
    const card = toHand(s, "p1", "Treasure Hunter");
    fake.addRestriction((_room, _host, query) =>
      query.kind === "play" && query.cardId === card.id && query.to !== undefined ? { rule: "355.17.b", note: "conquered only" } : null,
    );
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: card.id, location: "battlefieldA" }).error).toEqual({
      code: "invalid_location",
      rule: "355.17.b",
    });
    // Mageseeker Warden: "opponents can only play units to their base" — the Base stays valid.
    fake.resetFakes();
    fake.addRestriction((_room, _host, query) => (query.kind === "play" && query.to && query.to !== "base" ? { rule: "355.17.b" } : null));
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: card.id, location: "battlefieldA" }).error?.rule).toBe("355.17.b");
    s.as("p1").apply({ type: "rules_play", cardId: card.id, location: "base" }).expectOk();
  });

  it("[R806.3][EX:806.3] a card with Action keeps the normal Unit location restrictions", () => {
    const s = bareScenario({ p1: { energy: 2 } });
    const card = toHand(s, "p1", "Treasure Hunter");
    s.room.rules!.objects[card.id] = { grantedKeywords: ["Action"] };
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: card.id, location: "battlefieldB" }).error).toEqual({
      code: "invalid_location",
      rule: "355.2.a",
    });
  });

  it("[R358.5] an illegal play leaves no partial state (card, runes, pool, chain unchanged)", () => {
    const s = bareScenario({ p1: { energy: 2 } });
    setRunes(s, "p1", [{ domain: "Calm" }]);
    const card = toHand(s, "p1", "Treasure Hunter");
    const before = JSON.stringify(s.room);
    s.as("p1").apply({ type: "rules_play", cardId: card.id, location: "battlefieldC" });
    expect(s.lastError()?.code).toBe("invalid_location");
    expect(JSON.stringify(s.room)).toBe(before);
  });
});

describe("play-time choices [R355.3–R355.13][R411.2]", () => {
  it("[R355.8][R403.3] a spell whose required target has no legal choice cannot be played", () => {
    const s = bareScenario({ p1: { energy: 2, power: { Chaos: 2 } } });
    registerTargetSpell("Rebuke", (room, host) => [fake.unitAtBattlefieldSpec(room, host)]);
    const card = toHand(s, "p1", "Rebuke");
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: card.id }).error).toEqual({ code: "no_legal_targets", rule: "355.8" });
    expect(legalIntents(s.room, "p1", s.host).playableCardIds).not.toContain(card.id);
  });

  it("[R411.2][R355.7] a single legal target is chosen automatically", () => {
    const s = bareScenario({ p1: { energy: 2, power: { Chaos: 2 } } });
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    registerTargetSpell("Rebuke", (room, host) => [fake.unitAtBattlefieldSpec(room, host)]);
    const card = toHand(s, "p1", "Rebuke");
    s.as("p1").apply({ type: "rules_play", cardId: card.id, hold: true }).expectOk();
    expect(s.room.rules?.prompt).toBe(null);
    expect(s.room.rules?.chain[0]).toMatchObject({ status: "finalized", choices: { "target:0": enemy.id } });
  });

  it("[R354.1][R352.1][R411.2] with several legal targets the card waits Pending on the chain for a prompt", () => {
    const s = bareScenario({ p1: { energy: 2, power: { Chaos: 2 } } });
    const a = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const b = place(s, "p2", "Stellacorn Herder", "battlefieldB");
    registerTargetSpell("Rebuke", (room, host) => [fake.unitAtBattlefieldSpec(room, host)]);
    const card = toHand(s, "p1", "Rebuke");
    s.as("p1").apply({ type: "rules_play", cardId: card.id }).expectOk();
    expect(s.room.rules?.chain).toHaveLength(1);
    expect(s.room.rules?.chain[0]?.status).toBe("pending");
    expect(turnState(s.room)).toBe("neutral_closed");
    expect(whoMayAct(s.room)).toMatchObject({ kind: "prompt", player: "p1" });
    // Nothing is paid before the choices are made (357 follows 355).
    expect(pool(s, "p1")).toEqual({ energy: 2, power: { Chaos: 2 } });
    const prompt = s.room.rules!.prompt!;
    expect(prompt.options?.map((option) => option.id).sort()).toEqual([a.id, b.id].sort());
    s.as("p1").choose({ optionIds: [b.id] }).expectOk();
    expect(s.room.rules?.chain[0]).toMatchObject({ choices: { "target:0": b.id } });
    // Finalized, paid, and auto-passed to P2 (owner decision 3).
    expect(pool(s, "p1")).toEqual({ energy: 0, power: {} });
    expect(s.room.rules?.priority).toBe("p2");
    expect(s.room.rules?.history.cardsPlayedThisTurn.p1).toBe(1);
  });

  it("[R355.9] an explicitly chosen target must be a legal option", () => {
    const s = bareScenario({ p1: { energy: 2, power: { Chaos: 2 } } });
    place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const inBase = place(s, "p2", "Stellacorn Herder", "base");
    registerTargetSpell("Rebuke", (room, host) => [fake.unitAtBattlefieldSpec(room, host)]);
    const card = toHand(s, "p1", "Rebuke");
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: card.id, targets: [inBase.id] }).error).toEqual({
      code: "illegal_target",
      rule: "355.9",
    });
  });

  it("[R355.13] “up to” targets with no legal choice can be played with zero targets", () => {
    const s = bareScenario({ p1: { energy: 1 } });
    registerTargetSpell("Gust", (room, host) => [{ ...fake.unitAtBattlefieldSpec(room, host), min: 0, max: 2 }]);
    const card = toHand(s, "p1", "Gust");
    s.as("p1").apply({ type: "rules_play", cardId: card.id, hold: true }).expectOk();
    expect(s.room.rules?.chain[0]?.choices["target:0"]).toEqual([]);
  });

  it("[R355.14.c][EX:355.14.c] split damage cannot choose more targets than its damage", () => {
    const s = bareScenario({ p1: { energy: 1 } });
    const units = [
      place(s, "p2", "Caitlyn, Patrolling", "base"),
      place(s, "p2", "Stellacorn Herder", "base"),
      place(s, "p2", "Treasure Hunter", "base"),
    ];
    // "Split 2 damage" → up to 2 targets.
    registerTargetSpell("Gust", (room, host) => [fake.anyUnitSpec(room, host, { min: 1, max: 2 })]);
    const card = toHand(s, "p1", "Gust");
    expect(
      applyAndExplain(s, "p1", { type: "rules_play", cardId: card.id, choices: { "target:0": units.map((u) => u.id) } }).error?.code,
    ).toBe("invalid_choice");
    s.as("p1").apply({ type: "rules_play", cardId: card.id, hold: true, choices: { "target:0": [units[0]!.id, units[1]!.id] } }).expectOk();
  });

  it("[R358.1][EX:358.1] the bound choices must pass the effect's legality check", () => {
    const s = bareScenario({ p1: { energy: 1 } });
    place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    registerTargetSpell("Gust", (room, host) => [fake.unitAtBattlefieldSpec(room, host)]);
    fake.setValidator("Gust", () => ({ ok: false, code: "illegal_target", rule: "355.9.b" }));
    const card = toHand(s, "p1", "Gust");
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: card.id }).error).toEqual({ code: "illegal_target", rule: "355.9.b" });
  });

  it("[R355.5.b][EX:355.5.b] a Unit's play trigger chooses its targets later, not while the Unit is played", () => {
    const s = bareScenario({ p1: { energy: 8, power: { Calm: 2 } } });
    // "When you play me, give a unit +8 Might" — no target is chosen to play the unit.
    registerTestCardScript({ name: "Whiteflame Protector", text: "test", status: "implemented", abilities: [fake.fakeAbility("Whiteflame Protector")] });
    fake.setSpecs("Whiteflame Protector", (room, host) => [fake.anyUnitSpec(room, host)]);
    const card = toHand(s, "p1", "Whiteflame Protector");
    s.as("p1").apply({ type: "rules_play", cardId: card.id }).expectOk();
    expect(s.room.rules?.prompt).toBe(null);
    expect(boardOf(s, "p1").base.some((entry) => entry.id === card.id)).toBe(true);
  });
});

describe("additional costs [R356.2][R805][R809][R357.2]", () => {
  it("[R805.1.b][R805.6] Accelerate is an optional [1][C] additional cost; paid, the Unit enters ready", () => {
    const s = bareScenario({ p1: { energy: 4, power: { Chaos: 1 } } });
    const card = toHand(s, "p1", "Reckless Innovator");
    const legal = legalIntents(s.room, "p1", s.host).playable?.find((detail) => detail.cardId === card.id);
    expect(legal?.optionalCosts).toEqual(["accelerate"]);
    s.as("p1").apply({ type: "rules_play", cardId: card.id, optionalCosts: ["accelerate"] }).expectOk();
    expect(boardOf(s, "p1").base.find((entry) => entry.id === card.id)?.exhausted).toBe(false);
    expect(pool(s, "p1")).toEqual({ energy: 0, power: {} });
    expect(s.events().map((event) => event.type)).toContain("enters_ready");
    expect(s.events().map((event) => event.type)).not.toContain("ready");
  });

  it("[R805.1.b.1][R355.1.a] Accelerate's Power must match the Unit's Domain; unknown optional ids are rejected", () => {
    const s = bareScenario({ p1: { energy: 4, power: { Calm: 1 } } });
    const card = toHand(s, "p1", "Reckless Innovator");
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: card.id, optionalCosts: ["accelerate"] }).error?.code).toBe(
      "insufficient_resources",
    );
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: card.id, optionalCosts: ["repeat"] }).error).toEqual({
      code: "invalid_choice",
      rule: "355.1.a",
    });
    s.as("p1").apply({ type: "rules_play", cardId: card.id }).expectOk();
    expect(boardOf(s, "p1").base.find((entry) => entry.id === card.id)?.exhausted).toBe(true);
  });

  it("[R356.2.b.1][R135.2.b.7] an optional additional cost is paid only when chosen and is recorded", () => {
    const s = bareScenario({ p1: { energy: 2, power: { Calm: 1 } } });
    const keeper = toHand(s, "p1", "Clockwork Keeper");
    s.as("p1").apply({ type: "rules_play", cardId: keeper.id, optionalCosts: ["optional:0"], hold: true }).expectOk();
    expect(pool(s, "p1")).toEqual({ energy: 0, power: {} });
    const played = s.events().find((event) => event.type === "card_played");
    expect(played).toBeTruthy();
    const s2 = bareScenario({ p1: { energy: 2, power: { Calm: 1 } } });
    const keeper2 = toHand(s2, "p1", "Clockwork Keeper");
    // Explicit `[]` declines the optional cost (355.1.a); no prompt is opened.
    s2.as("p1").apply({ type: "rules_play", cardId: keeper2.id, optionalCosts: [] }).expectOk();
    expect(pool(s2, "p1")).toEqual({ energy: 0, power: { Calm: 1 } });
  });

  it("[R356.2.a.1][EX:356.2.a.1][EX:356.7] a mandatory additional cost (kill a friendly unit) must be paid", () => {
    const s = bareScenario({ p1: { energy: 4 }, extraCards: { p1: ["Cruel Patron"] } });
    const patron = s.handCard("p1", "Cruel Patron") ?? toHand(s, "p1", "Cruel Patron");
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: patron.id }).error).toEqual({
      code: "insufficient_resources",
      rule: "357.2",
    });
    const victim = place(s, "p1", "Treasure Hunter", "base");
    s.as("p1").apply({ type: "rules_play", cardId: patron.id }).expectOk();
    expect(s.host.findCard(s.room, victim.id)?.zone).toBe("trash");
    expect(boardOf(s, "p1").base.some((entry) => entry.id === patron.id)).toBe(true);
  });

  it("[R357.2][R411.2] several possible cost objects open a choose-cost prompt; the answer pays and finishes", () => {
    const s = bareScenario({ p1: { energy: 4 }, extraCards: { p1: ["Cruel Patron"] } });
    const patron = s.handCard("p1", "Cruel Patron") ?? toHand(s, "p1", "Cruel Patron");
    const a = place(s, "p1", "Treasure Hunter", "base");
    const b = place(s, "p1", "Stellacorn Herder", "base");
    s.as("p1").apply({ type: "rules_play", cardId: patron.id }).expectOk();
    expect(s.room.rules?.prompt).toMatchObject({ kind: "choose-cost", min: 1, max: 1, data: { category: "kill" } });
    expect(s.room.rules?.chain[0]?.status).toBe("pending");
    expect(pool(s, "p1").energy).toBe(4);
    s.as("p1").choose({ optionIds: [b.id] }).expectOk();
    expect(s.host.findCard(s.room, b.id)?.zone).toBe("trash");
    expect(s.host.findCard(s.room, a.id)?.zone).toBe("base");
    expect(boardOf(s, "p1").base.some((entry) => entry.id === patron.id)).toBe(true);
    expect(pool(s, "p1").energy).toBe(0);
  });

  it("[R357.2.a][EX:357.2.a] a cost whose action is replaced is still paid", () => {
    const s = bareScenario({ p1: { energy: 4 }, extraCards: { p1: ["Cruel Patron"] } });
    const patron = s.handCard("p1", "Cruel Patron") ?? toHand(s, "p1", "Cruel Patron");
    const victim = place(s, "p1", "Treasure Hunter", "base");
    // Zhonya's Hourglass: the death is replaced (here: prevented) — the cost still counts as paid.
    const off = registerActionInterceptor((_room, _step, proposal) => (proposal.type === "kill" ? null : proposal));
    try {
      s.as("p1").apply({ type: "rules_play", cardId: patron.id }).expectOk();
    } finally {
      off();
    }
    expect(s.host.findCard(s.room, victim.id)?.zone).toBe("base");
    expect(boardOf(s, "p1").base.some((entry) => entry.id === patron.id)).toBe(true);
  });

  it("[R809.1.c][R809.1.c.1] choosing an opponent's Deflect unit costs [A] more, payable with any Domain", () => {
    const s = bareScenario({ p1: { energy: 2, power: { Chaos: 2 } } });
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects[enemy.id] = { grantedKeywords: ["Deflect"] };
    registerTargetSpell("Rebuke", (room, host) => [fake.unitAtBattlefieldSpec(room, host)]);
    const card = toHand(s, "p1", "Rebuke");
    expect(applyAndExplain(s, "p1", { type: "rules_play", cardId: card.id }).error?.code).toBe("insufficient_resources");
    setPool(s, "p1", 2, { Chaos: 2, Fury: 1 });
    s.as("p1").apply({ type: "rules_play", cardId: card.id }).expectOk();
    expect(pool(s, "p1")).toEqual({ energy: 0, power: {} });
  });

  it("[R358.5] a play that cannot be paid after its prompt is undone: card back in place, Priority restored", () => {
    const s = bareScenario({ p1: { energy: 2, power: { Chaos: 2 } } });
    const plain = place(s, "p2", "Stellacorn Herder", "battlefieldB");
    const deflect = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects[deflect.id] = { grantedKeywords: ["Deflect"] };
    registerTargetSpell("Rebuke", (room, host) => [fake.unitAtBattlefieldSpec(room, host)]);
    toHand(s, "p1", "Gust");
    const card = toHand(s, "p1", "Rebuke");
    toHand(s, "p1", "Defy");
    const handBefore = boardOf(s, "p1").hand.map((entry) => entry.id);
    s.as("p1").apply({ type: "rules_play", cardId: card.id }).expectOk();
    expect(s.room.rules?.prompt?.options?.map((o) => o.id).sort()).toEqual([plain.id, deflect.id].sort());
    s.as("p1").choose({ optionIds: [deflect.id] }).expectOk();
    expect(s.events().map((event) => event.type)).toContain("play_cancelled");
    expect(s.room.rules?.chain).toEqual([]);
    expect(s.room.rules?.prompt).toBe(null);
    expect(boardOf(s, "p1").hand.map((entry) => entry.id)).toEqual(handBefore);
    expect(s.room.rules?.priority).toBe("p1");
    expect(pool(s, "p1")).toEqual({ energy: 2, power: { Chaos: 2 } });
    expect(turnState(s.room)).toBe("neutral_open");
  });
});
