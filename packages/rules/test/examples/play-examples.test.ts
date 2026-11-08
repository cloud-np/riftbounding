/**
 * Official examples for the play domain (Riftbound Core Rules 2026-10-09: 204–206, 355–359,
 * 431, 820) that the engine can express. Resolution-time examples (359.3.e/f) belong to the
 * effect interpreter (R2-effects); see docs/rules/play.md for the uncovered list.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCardScripts, legalIntents, payCost, primitives, registerCardScript } from "../../src";
import { registerAdditionalCosts } from "../../src/play/additional-costs";
import { determineTotalCost } from "../../src/play/total-cost";
import { printedCardCost, resolveCost, totalPower } from "../../src/play/cost-model";
import { snapshotInfo } from "../../src/play/card-info";
import { legionActive } from "../../src/play/keyword-helpers";
import { removeChainItem } from "../../src/timing/fepr";
import * as fake from "../rules/play/fake-effects";
import { bareScenario, boardOf, place, pool, setPool, setRunes, stepOf, toHand } from "../rules/play/helpers";

vi.mock("../../src/effects/choices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/effects/choices")>();
  const f = await import("../rules/play/fake-effects");
  return { ...actual, requiredChoices: f.requiredChoices, validateChoices: f.validateChoices };
});
vi.mock("../../src/layers/costs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/layers/costs")>();
  const f = await import("../rules/play/fake-effects");
  return { ...actual, costAdjustments: f.costAdjustments };
});

beforeEach(() => fake.resetFakes());
afterEach(() => clearCardScripts());

function noopSpell(name: string) {
  registerCardScript({ name, text: "test", status: "implemented", abilities: [{ kind: "spell", effect: { op: "seq", effects: [] } }] });
}

describe("costs [R204][R206]", () => {
  it("[EX:204.3.a] costs within instructions are paid as the spell or ability resolves (payCost)", () => {
    const s = bareScenario({ p1: { energy: 3, power: { Calm: 1, Chaos: 1 } } });
    boardOf(s, "p1").legendXp = 2;
    const step = stepOf(s);
    // Bullet Time: "Pay any amount of [A]" (here 2).
    expect(payCost(s.room, step, "p1", { power: { any: 2 } })).toEqual({ ok: true });
    // Ancient Henge: "Pay any amount of Energy" (here 3).
    expect(payCost(s.room, step, "p1", { energy: 3 })).toEqual({ ok: true });
    // Insightful Investigator: "You may pay 2 XP".
    expect(payCost(s.room, step, "p1", { spendXp: 2 })).toEqual({ ok: true });
    expect(pool(s, "p1")).toEqual({ energy: 0, power: {} });
    expect(boardOf(s, "p1").legendXp).toBe(0);
  });

  it("[EX:206] effects read the printed cost, not what was paid (Repeat paid)", () => {
    const s = bareScenario({ p1: { energy: 4 }, extraCards: { p1: ["Desert's Call"] } });
    const call = s.handCard("p1", "Desert's Call") ?? toHand(s, "p1", "Desert's Call");
    s.as("p1").apply({ type: "rules_play", cardId: call.id, optionalCosts: ["repeat"], hold: true }).expectOk();
    const item = s.room.rules!.chain[0]!;
    expect(item.totalCost).toEqual({ energy: 4, power: 0 });
    expect(printedCardCost(snapshotInfo(item.cardSnapshot!)).energy).toBe(2);
  });
});

describe("making choices [R355]", () => {
  it("[EX:355.5.a] “Stun a unit at a battlefield” is a choice; “Kill all gear” is not", () => {
    const s = bareScenario({ p1: { energy: 2 } });
    place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    place(s, "p2", "Stellacorn Herder", "battlefieldB");
    registerCardScript({ name: "Gust", text: "Stun a unit at a battlefield.", status: "implemented", abilities: [fake.fakeAbility("Gust")] });
    fake.setSpecs("Gust", (room, host) => [fake.unitAtBattlefieldSpec(room, host)]);
    registerCardScript({ name: "En Garde", text: "Kill all gear.", status: "implemented", abilities: [fake.fakeAbility("En Garde")] });
    const stun = toHand(s, "p1", "Gust");
    const killAll = toHand(s, "p1", "En Garde");
    s.as("p1").apply({ type: "rules_play", cardId: killAll.id, hold: true }).expectOk();
    expect(s.room.rules?.prompt).toBe(null);
    s.as("p1").apply({ type: "rules_play", cardId: stun.id, hold: true }).expectOk();
    expect(s.room.rules?.prompt).toMatchObject({ kind: "choose-target", data: { key: "target:0", targeted: true } });
  });

  it("[EX:820.2.a] Repeat's additional execution makes its own choices in step 2", () => {
    const s = bareScenario({ p1: { energy: 4 }, extraCards: { p1: ["Desert's Call"] } });
    const a = place(s, "p2", "Caitlyn, Patrolling", "base");
    const b = place(s, "p2", "Stellacorn Herder", "base");
    registerCardScript({ name: "Desert's Call", text: "test", status: "implemented", abilities: [fake.fakeAbility("Desert's Call")] });
    // Rocket Barrage-style: one target per execution; a paid Repeat adds a second choice.
    fake.setSpecs("Desert's Call", (room, host, ctx) => [
      fake.anyUnitSpec(room, host),
      ...(ctx.choices["cost:repeat"] ? [fake.anyUnitSpec(room, host, { key: "target:repeat" })] : []),
    ]);
    const call = s.handCard("p1", "Desert's Call") ?? toHand(s, "p1", "Desert's Call");
    s.as("p1")
      .apply({ type: "rules_play", cardId: call.id, optionalCosts: ["repeat"], hold: true, choices: { "target:0": a.id, "target:repeat": b.id } })
      .expectOk();
    expect(s.room.rules?.chain[0]?.choices).toMatchObject({ "target:0": a.id, "target:repeat": b.id });
  });
});

describe("determine total cost [R356]", () => {
  it("[EX:356.1.b.3] ignoring the base cost still leaves a chosen optional additional cost to pay", () => {
    const s = bareScenario({ extraCards: { p1: ["Legion Rearguard"] } });
    const card = s.handCard("p1", "Legion Rearguard") ?? toHand(s, "p1", "Legion Rearguard");
    const info = s.host.cardInfo(s.room, card.id)!;
    const total = determineTotalCost(s.room, s.host, {
      playerId: "p1",
      base: printedCardCost(info),
      domains: ["Fury"],
      permission: { ignore: "base" },
      additional: [{ id: "accelerate", optional: true, cost: { energy: 1, additional: { "power:self": 1 } }, rule: "805.1.b" }],
      optionalCosts: ["accelerate"],
      choices: {},
      adjustment: { playerId: "p1", cardId: card.id },
    });
    expect(total.cost.energy).toBe(1);
    expect(total.cost.power).toEqual([{ domains: ["Fury"], count: 1 }]);
  });

  it("[EX:356.2.b.1] a chosen optional cost and the discount it grants are both applied", () => {
    const s = bareScenario({ p1: { energy: 4 }, extraCards: { p1: ["Brazen Buccaneer"] } });
    const card = s.handCard("p1", "Brazen Buccaneer") ?? toHand(s, "p1", "Brazen Buccaneer");
    const fodder = toHand(s, "p1", "Gust");
    // "If you do, reduce my cost by [2]" (R2-effects' cost layer reads the chosen optional costs).
    fake.addAdjustment((_room, _host, query) =>
      query.cardId === card.id && (query.optionalCosts as string[] | undefined)?.includes("optional:0") ? [{ energy: -2 }] : [],
    );
    expect(s.as("p1").apply({ type: "rules_play", cardId: card.id }).lastError()?.code).toBe("insufficient_resources");
    s.as("p1").apply({ type: "rules_play", cardId: card.id, optionalCosts: ["optional:0"], plan: { discard: [fodder.id] } }).expectOk();
    expect(boardOf(s, "p1").trash.some((entry) => entry.id === fodder.id)).toBe(true);
    expect(pool(s, "p1").energy).toBe(0);
  });

  it("[EX:356.4.f.1] an optional additional cost reduced to 0 still counts as paid", () => {
    const s = bareScenario({ p1: { energy: 2 } });
    const keeper = toHand(s, "p1", "Clockwork Keeper");
    // "Units you play cost [A] less."
    fake.addAdjustment((room, host, query) =>
      typeof query.cardId === "string" && (host.cardInfo(room, query.cardId)?.type ?? "").includes("Unit") ? [{ power: { any: -1 } }] : [],
    );
    s.as("p1").apply({ type: "rules_play", cardId: keeper.id, optionalCosts: ["optional:0"], hold: true }).expectOk();
    expect(pool(s, "p1")).toEqual({ energy: 0, power: {} });
    const played = s.events().find((event) => event.type === "card_played");
    expect(played).toBeTruthy();
  });

  it("[EX:356.4.g] a variable discount is checked when the total cost is determined", () => {
    const s = bareScenario({ p1: { energy: 5 }, extraCards: { p1: ["Brazen Buccaneer"] } });
    const card = s.handCard("p1", "Brazen Buccaneer") ?? toHand(s, "p1", "Brazen Buccaneer");
    const fodder = toHand(s, "p1", "Gust");
    s.host.moveCardTo(s.room, "p1", "hand", "trash", toHand(s, "p1", "Defy").id);
    // Rhasa-style: "I cost [1] less for each card in your trash" (1 card now).
    fake.addAdjustment((room, host, query) => (query.cardId === card.id ? [{ energy: -host.zoneCards(room, "p1", "trash").length }] : []));
    s.as("p1").apply({ type: "rules_play", cardId: card.id, optionalCosts: ["optional:0"], plan: { discard: [fodder.id] } }).expectOk();
    // 6 - 1 = 5 was determined before the discard put a second card in the trash (357 after 356).
    expect(pool(s, "p1").energy).toBe(0);
  });
});

describe("pay costs and check legality [R357][R358]", () => {
  it("[EX:357.2] non-standard costs (kill a friendly unit and discard) are all paid", () => {
    const s = bareScenario({ p1: { energy: 4 }, extraCards: { p1: ["Cruel Patron"] } });
    const patron = s.handCard("p1", "Cruel Patron") ?? toHand(s, "p1", "Cruel Patron");
    const off = registerAdditionalCosts("Cruel Patron", [
      { id: "mandatory:0", optional: false, cost: { kill: { cardType: "unit", controller: "self" }, discard: 1 }, rule: "356.2.a.1" },
    ]);
    try {
      const victim = place(s, "p1", "Treasure Hunter", "base");
      const fodder = toHand(s, "p1", "Gust");
      s.as("p1").apply({ type: "rules_play", cardId: patron.id, plan: { discard: [fodder.id] } }).expectOk();
      expect(s.host.findCard(s.room, victim.id)?.zone).toBe("trash");
      expect(s.host.findCard(s.room, fodder.id)?.zone).toBe("trash");
    } finally {
      off();
    }
  });

  it("[EX:358.4] a card that closes a Showdown needs Action or Reaction", () => {
    const s = bareScenario({ p1: { energy: 4, power: { Chaos: 2 } } });
    place(s, "p1", "Stellacorn Herder", "battlefieldA");
    s.room.rules!.showdown = { battlefield: "battlefieldA", kind: "non_combat", startedBy: "p1" };
    s.room.rules!.focus = "p1";
    noopSpell("Rebuke");
    const unit = toHand(s, "p1", "Treasure Hunter");
    const action = toHand(s, "p1", "Rebuke");
    expect(s.as("p1").apply({ type: "rules_play", cardId: unit.id }).lastError()).toEqual({ code: "showdown_requires_action", rule: "308.1.a" });
    s.as("p1").apply({ type: "rules_play", cardId: action.id, hold: true }).expectOk();
  });

  it("[EX:358.4] a card played into a Closed State it did not close needs Reaction", () => {
    const s = bareScenario({ p1: { energy: 4, power: { Chaos: 2 } } });
    noopSpell("Rebuke");
    noopSpell("Gust");
    noopSpell("Defy");
    const gust = toHand(s, "p1", "Gust");
    const rebuke = toHand(s, "p1", "Rebuke");
    s.as("p1").apply({ type: "rules_play", cardId: gust.id, hold: true }).expectOk();
    expect(s.as("p1").apply({ type: "rules_play", cardId: rebuke.id }).lastError()).toEqual({
      code: "closed_state_requires_reaction",
      rule: "309.1.a",
    });
    expect(legalIntents(s.room, "p1", s.host).playableCardIds).not.toContain(rebuke.id);
  });

  it("[EX:359.3.e.10] a spell is played once Finalized, whatever happens when it resolves", () => {
    const s = bareScenario({ p1: { energy: 1 } });
    noopSpell("Gust");
    const gust = toHand(s, "p1", "Gust");
    s.as("p1").apply({ type: "rules_play", cardId: gust.id, hold: true }).expectOk();
    const item = s.room.rules!.chain[0]!;
    removeChainItem(s.room, item.id); // e.g. countered (420.4.b)
    expect(s.room.rules?.history.cardsPlayedThisTurn.p1).toBe(1);
    expect(legionActive(s.room, "p1", "another-card")).toBe(true);
  });
});

describe("channel [R431]", () => {
  it("[EX:431.2] “Channel 1 rune exhausted” puts the top rune onto the board exhausted", () => {
    const s = bareScenario();
    setRunes(s, "p1", []);
    const step = stepOf(s);
    const [id] = primitives.channelRunes(s.room, "p1", 1, step, { exhausted: true });
    expect(boardOf(s, "p1").runeArea.find((rune) => rune.id === id)?.exhausted).toBe(true);
    setPool(s, "p1", 0);
    expect(totalPower(resolveCost({ power: { any: 1 } }, []))).toBe(1);
  });
});
