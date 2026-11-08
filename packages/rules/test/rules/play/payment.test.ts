import { describe, expect, it } from "vitest";
import { canPayCost, payCost } from "../../../src";
import { applyCostDeltas, emptyCost, printedCardCost, resolveCost } from "../../../src/play/cost-model";
import { planResources, validateResources } from "../../../src/play/planner";
import type { PaymentSources } from "../../../src/play/sources";
import { bareScenario, boardOf, place, pool, runeState, setPool, setRunes, stepOf, toHand } from "./helpers";

function sources(partial: Partial<PaymentSources>): PaymentSources {
  return { playerId: "p1", pool: { energy: 0, power: {} }, runes: [], ...partial };
}

describe("cost model [R131][R135.2.e][R356]", () => {
  it("[R131.2][R135.2.e.6.c] a printed cost is Energy plus [C] of the card's Domains", () => {
    const cost = printedCardCost({ name: "Blade", type: "Gear", keywords: [], energyCost: 3, powerCost: 1, domains: ["Calm", "Chaos"] });
    expect(cost.energy).toBe(3);
    expect(cost.power).toEqual([{ domains: ["Calm", "Chaos"], count: 1 }]);
  });

  it("[R135.2.e.6.b] [C] on a card with no Domain is processed as [A]", () => {
    const cost = printedCardCost({ name: "Token", type: "Gear", keywords: [], energyCost: 0, powerCost: 1, domains: [] });
    expect(cost.power).toEqual([{ domains: "any", count: 1 }]);
  });

  it("[R356.3][R356.4][R356.6] increases apply before discounts and costs never go below 0", () => {
    const base = resolveCost({ energy: 2, power: { Calm: 1 } }, ["Calm"]);
    const adjusted = applyCostDeltas(base, [{ energy: -5 }, { energy: 1, power: { any: 1 } }, { power: { Calm: -1 } }]);
    expect(adjusted.energy).toBe(0);
    // The [A] increase stays; the Calm discount removed the Calm requirement (most restrictive first).
    expect(adjusted.power).toEqual([{ domains: "any", count: 1 }]);
  });

  it("[R356.4.f] a discount can reduce an additional Power cost to 0", () => {
    const base = resolveCost({ additional: { "power:self": 1 } }, ["Calm"]);
    expect(applyCostDeltas(base, [{ power: { any: -1 } }]).power).toEqual([]);
  });

  it("[R203.3] an unsupported cost part is unpayable, never free", () => {
    const cost = resolveCost({ additional: { sacrificeFirstborn: true } }, []);
    expect(cost.unsupported).toEqual(["additional:sacrificeFirstborn"]);
    expect(emptyCost().unsupported).toEqual([]);
  });
});

describe("resource planner [R164.2][R166][R357.1]", () => {
  it("[R166][R357.1] pool Energy is spent before any rune is exhausted", () => {
    const result = planResources(
      sources({ pool: { energy: 1, power: {} }, runes: [{ id: "r1", domain: "Calm", exhausted: false }] }),
      { energy: 2, power: [] },
    );
    expect(result).toMatchObject({ ok: true, plan: { poolEnergy: 1, exhaustRunes: ["r1"], recycleRunes: [] } });
  });

  it("[R164.2.b] an exhausted rune can still be recycled for Power of its Domain", () => {
    const result = planResources(
      sources({
        runes: [
          { id: "ready", domain: "Calm", exhausted: false },
          { id: "spent", domain: "Calm", exhausted: true },
        ],
      }),
      { energy: 0, power: [{ domains: ["Calm"], count: 1 }] },
    );
    expect(result).toMatchObject({ ok: true, plan: { exhaustRunes: [], recycleRunes: ["spent"] } });
  });

  it("[R164.2.a][R164.2.b] one ready rune pays [1][C]: exhausted for Energy, then recycled", () => {
    const result = planResources(
      sources({
        runes: [
          { id: "a", domain: "Calm", exhausted: false },
          { id: "b", domain: "Calm", exhausted: false },
        ],
      }),
      { energy: 1, power: [{ domains: ["Calm"], count: 1 }] },
    );
    expect(result).toMatchObject({ ok: true, plan: { exhaustRunes: ["a"], recycleRunes: ["a"] } });
  });

  it("[R163.2.a] Power of the wrong Domain cannot pay a Domain cost", () => {
    const result = planResources(sources({ runes: [{ id: "c", domain: "Chaos", exhausted: false }] }), {
      energy: 0,
      power: [{ domains: ["Calm"], count: 1 }],
    });
    expect(result).toMatchObject({ ok: false, code: "insufficient_resources", rule: "357.1" });
  });

  it("[R135.2.e.5.a][R163.2.b] [A] is paid by any Domain and universal pool Power pays any cost", () => {
    expect(
      planResources(sources({ runes: [{ id: "c", domain: "Chaos", exhausted: false }] }), {
        energy: 0,
        power: [{ domains: "any", count: 1 }],
      }).ok,
    ).toBe(true);
    expect(
      planResources(sources({ pool: { energy: 0, power: { any: 1 } } }), {
        energy: 0,
        power: [{ domains: ["Calm"], count: 1 }],
      }),
    ).toMatchObject({ ok: true, plan: { poolPower: { any: 1 } } });
  });

  it("[R135.2.e.6.c] multi-Domain slots are matched after single-Domain ones", () => {
    const result = planResources(
      sources({
        runes: [
          { id: "calm", domain: "Calm", exhausted: true },
          { id: "chaos", domain: "Chaos", exhausted: true },
        ],
      }),
      { energy: 0, power: [{ domains: ["Calm", "Chaos"], count: 1 }, { domains: ["Calm"], count: 1 }] },
    );
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect([...result.plan.recycleRunes].sort()).toEqual(["calm", "chaos"]);
  });

  it("[R415.4][R357.1] an explicit plan cannot exhaust an exhausted rune or overpay", () => {
    const src = sources({
      pool: { energy: 1, power: {} },
      runes: [
        { id: "x", domain: "Calm", exhausted: true },
        { id: "y", domain: "Calm", exhausted: false },
      ],
    });
    expect(validateResources(src, { energy: 1, power: [] }, { exhaustRunes: ["x"] })).toMatchObject({
      ok: false,
      code: "invalid_payment",
      rule: "415.4",
    });
    expect(validateResources(src, { energy: 1, power: [] }, { poolEnergy: 1, exhaustRunes: ["y"] })).toMatchObject({
      ok: false,
      code: "invalid_payment",
      rule: "357.1",
    });
    expect(validateResources(src, { energy: 1, power: [] }, { exhaustRunes: ["y"] }).ok).toBe(true);
  });
});

describe("payCost / canPayCost contract [R203][R357]", () => {
  it("[R357.1][R164.2] payCost exhausts and recycles runes and spends the pool", () => {
    const s = bareScenario();
    const [a, b] = setRunes(s, "p1", [{ domain: "Calm" }, { domain: "Chaos", exhausted: true }]);
    const step = stepOf(s);
    const cost = { energy: 1, power: { Chaos: 1 } };
    expect(canPayCost(s.room, s.host, "p1", cost)).toBe(true);
    expect(payCost(s.room, step, "p1", cost)).toEqual({ ok: true });
    expect(runeState(s, "p1", a!)).toBe("exhausted");
    expect(runeState(s, "p1", b!)).toBe("deck");
    expect(pool(s, "p1")).toEqual({ energy: 0, power: {} });
    expect(step.events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["exhaust", "add_resources", "recycle", "cost_paid"]),
    );
  });

  it("[R417.1.b] a recycled rune goes to the bottom of the Rune Deck", () => {
    const s = bareScenario();
    const [rune] = setRunes(s, "p1", [{ domain: "Calm", exhausted: true }]);
    payCost(s.room, stepOf(s), "p1", { power: { Calm: 1 } });
    expect(boardOf(s, "p1").runeDeck[0]?.id).toBe(rune);
  });

  it("[R357][R358.5] a failed payment leaves the draft and events untouched", () => {
    const s = bareScenario();
    setRunes(s, "p1", [{ domain: "Calm" }]);
    const before = JSON.stringify(s.room);
    const step = stepOf(s);
    const verdict = payCost(s.room, step, "p1", { energy: 1, power: { Chaos: 1 } });
    expect(verdict).toMatchObject({ ok: false, code: "insufficient_resources" });
    expect(JSON.stringify(s.room)).toBe(before);
    expect(step.events).toEqual([]);
  });

  it("[R415.5][R415.4] [E] exhausts the source and cannot be paid by an exhausted source", () => {
    const s = bareScenario();
    const unit = place(s, "p1", "Treasure Hunter", "base");
    const cost = { exhaust: { targetRef: "self" } };
    expect(canPayCost(s.room, s.host, "p1", cost, { sourceObjectId: unit.id })).toBe(true);
    expect(payCost(s.room, stepOf(s), "p1", cost, { sourceObjectId: unit.id })).toEqual({ ok: true });
    expect(s.host.isExhausted(s.room, unit.id)).toBe(true);
    expect(canPayCost(s.room, s.host, "p1", cost, { sourceObjectId: unit.id })).toBe(false);
  });

  it("[R357.2][R411.2] a kill cost with several candidates needs a choice; one candidate is forced", () => {
    const s = bareScenario();
    const first = place(s, "p1", "Treasure Hunter", "base");
    const cost = { kill: { cardType: "unit", controller: "self" as const } };
    // One friendly unit: forced.
    const forced = s.host.cloneRoom(s.room);
    expect(payCost(forced, stepOf(s), "p1", cost)).toEqual({ ok: true });
    const second = place(s, "p1", "Treasure Hunter", "base");
    expect(payCost(s.room, stepOf(s), "p1", cost)).toMatchObject({ ok: false, code: "invalid_choice", rule: "357.2" });
    expect(payCost(s.room, stepOf(s), "p1", cost, { plan: { kill: [second.id] } })).toEqual({ ok: true });
    expect(s.host.findCard(s.room, second.id)?.zone).toBe("trash");
    expect(s.host.findCard(s.room, first.id)?.zone).toBe("base");
  });

  it("[R423.1.a][R203.3] discard, points and XP costs need enough to pay", () => {
    const s = bareScenario();
    toHand(s, "p1", "Gust");
    const handSize = boardOf(s, "p1").hand.length;
    expect(canPayCost(s.room, s.host, "p1", { discard: handSize + 1 })).toBe(false);
    expect(canPayCost(s.room, s.host, "p1", { payPoints: 1 })).toBe(false);
    expect(canPayCost(s.room, s.host, "p1", { spendXp: 1 })).toBe(false);
    boardOf(s, "p1").legendXp = 2;
    s.host.setScore(s.room, "p1", 1);
    const step = stepOf(s);
    expect(payCost(s.room, step, "p1", { spendXp: 2, payPoints: 1 })).toEqual({ ok: true });
    expect(boardOf(s, "p1").legendXp).toBe(0);
    expect(s.host.score(s.room, "p1")).toBe(0);
  });

  it("[R166.2] floating Power in the pool pays without touching runes", () => {
    const s = bareScenario();
    const [rune] = setRunes(s, "p1", [{ domain: "Calm" }]);
    setPool(s, "p1", 0, { Calm: 1 });
    expect(payCost(s.room, stepOf(s), "p1", { power: { Calm: 1 } })).toEqual({ ok: true });
    expect(runeState(s, "p1", rune!)).toBe("ready");
    expect(pool(s, "p1").power).toEqual({});
  });
});
