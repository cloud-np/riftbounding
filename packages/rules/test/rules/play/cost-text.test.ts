import { describe, expect, it } from "vitest";
import { getCardByName } from "@rift/cards";
import {
  parseActivatedLine,
  parseAdditionalCosts,
  parseCostAlternatives,
  parseCostText,
  parseEquipCosts,
  parseRepeatCosts,
} from "../../../src/play/cost-text";
import { resolveCost } from "../../../src/play/cost-model";
import { planCardPlay } from "../../../src/play/process";
import { bareScenario, toHand } from "./helpers";

const text = (name: string) => getCardByName(name)?.text;

describe("printed cost text [R135.2.e][R204.1.b][R377.1]", () => {
  it("[R135.2.e.2][R135.2.e.5][R377.1] symbols: [N] Energy, [Rune]/[A] any Power, [Domain], [Tap] exhaust this", () => {
    expect(parseCostText("[1][Rune], [Tap]")).toEqual({ energy: 1, power: { any: 1 }, exhaust: { targetRef: "self" } });
    expect(parseCostText("[2][Calm][Calm]")).toEqual({ energy: 2, power: { Calm: 2 } });
    expect(parseCostText("Kill this, [Tap]")).toEqual({ kill: { targetRef: "self" }, exhaust: { targetRef: "self" } });
    expect(parseCostText("Discard 1, [1] [Fury]")).toEqual({ discard: 1, energy: 1, power: { Fury: 1 } });
    expect(parseCostText("Exhaust a unit you control")).toEqual({ exhaust: { cardType: "unit", controller: "self" } });
  });

  it("[R203.3] an instruction the engine cannot pay is kept as unsupported, never free", () => {
    const cost = parseCostText("Kill a friendly unit or gear, [Tap]");
    expect(resolveCost(cost, []).unsupported).toEqual(["additional:unsupported:Kill a friendly unit or gear"]);
  });

  it("[R377.1][R135.2.e.7] an activated line splits into cost, effect and its own permission keyword", () => {
    expect(parseActivatedLine("[Tap]: [REACTION] - [ADD] [Fury].")).toMatchObject({
      costText: "[Tap]",
      keywords: ["Reaction"],
      addsResources: true,
    });
    expect(parseActivatedLine("[Action]  Exhaust a unit you control, [tap] : Move a different unit.")).toMatchObject({
      costText: "Exhaust a unit you control, [tap]",
      keywords: ["Action"],
    });
    expect(parseActivatedLine("[TAP]: [LEGION] - The next unit you play this turn enters ready.")?.costText).toBe("[TAP]");
    expect(parseActivatedLine("When I move, draw 1.")).toBe(null);
  });

  it("[R204.1.b][R818.1.c] Equip costs and their alternatives", () => {
    expect(parseEquipCosts(text("Blade of the Exile"))).toEqual([[{ power: { any: 1 } }, { exhaust: { cardType: "unit", controller: "self" } }]]);
    expect(parseEquipCosts(text("Skyfall of Areion"))).toEqual([[{ energy: 1, power: { Fury: 1 } }]]);
    expect(parseCostAlternatives("[1] or [C]")).toEqual([{ energy: 1 }, { additional: { "power:self": 1 } }]);
  });

  it("[R820.1.c] Repeat cost formats", () => {
    expect(parseRepeatCosts(text("Desert's Call"))).toEqual([{ energy: 2 }]);
    expect(parseRepeatCosts(text("Piercing Light"))).toEqual([{ energy: 2, power: { Fury: 1 } }]);
    expect(parseRepeatCosts(text("Feral Strength"))).toEqual([{ energy: 2 }]);
    expect(parseRepeatCosts(text("Called Shot"))).toEqual([{ power: { Chaos: 1 } }]);
  });

  it("[R204.2][R356.2] “as an additional cost” phrases: optional with “may”, mandatory otherwise", () => {
    expect(parseAdditionalCosts(text("Clockwork Keeper"))).toEqual([{ optional: true, cost: { power: { Calm: 1 } }, text: "[Calm]" }]);
    expect(parseAdditionalCosts(text("Meditation"))).toEqual([
      { optional: true, cost: { exhaust: { cardType: "unit", controller: "self" } }, text: "exhaust a friendly unit" },
    ]);
    expect(parseAdditionalCosts(text("Cruel Patron"))).toEqual([
      { optional: false, cost: { kill: { cardType: "unit", controller: "self" } }, text: "kill a friendly unit" },
    ]);
    expect(parseAdditionalCosts(text("Bard, Mercurial"))?.[0]).toMatchObject({ optional: true, cost: { exhaust: { zone: "legend" } } });
    // Accelerate's reminder text is not an additional-cost phrase (it comes from the keyword).
    expect(parseAdditionalCosts(text("Reckless Innovator"))).toEqual([]);
  });
});

describe("Limited plays [R420.3]", () => {
  it("[R420.3][R420.3.b.1] an effect's play skips Discretionary timing and may ignore costs", () => {
    const s = bareScenario();
    const card = toHand(s, "p1", "Treasure Hunter");
    s.host.moveCardTo(s.room, "p1", "hand", "trash", card.id);
    // Not playable from the trash by default, and unaffordable anyway.
    expect(planCardPlay(s.room, "p1", card.id, { choices: {}, optionalCosts: [] }, s.host)).toMatchObject({ ok: false, code: "not_in_hand" });
    s.room.rules!.priority = null; // e.g. during a resolution
    const plan = planCardPlay(s.room, "p1", card.id, { choices: {}, optionalCosts: [] }, s.host, {
      permission: { id: "effect", rule: "420.3", ignore: "base" },
    });
    expect(plan).toMatchObject({ ok: true, location: "base", cost: { energy: 0, power: [] } });
  });
});
