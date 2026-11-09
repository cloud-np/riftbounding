/**
 * Unleashed gear with plain abilities:
 *
 * - Sumpworks Map (UNL-085): [Reaction], [Temporary] (engine keywords); when an opponent scores
 *   (470), draw 1.
 * - Shepherd's Heirloom (UNL-158): play effect gain 1 XP; [Equip] — Spend 1 XP.
 * - Hunter's Machete (UNL-096): [Equip][Body]. Effect text while attached (718.3/718.4): [Hunt]
 *   and +2 [Might] for the top-most card; the gear itself has no Hunt (suppressed).
 * - Soul Sword (UNL-039): [Equip][Calm]. Effect text: +1 [Might]; [Level 3] an additional +1
 *   [Might] (824).
 *
 * [Equip] is scripted as what it is short for (818.1.c.2): "[Cost]: Attach this gear to a unit you
 * control" (the target is a Target, 818.1.b.1); the engine's built-in `equip:<n>` entry only opens
 * the manual window.
 * - Fresh Beans (UNL-011): when you play a unit during a showdown, you may exhaust this to draw 1
 *   (740.4.a).
 * - Blood Rose (UNL-109): when you play a unit, you may pay [1] to gain 1 XP; Spend 3 XP, [Tap]:
 *   ready a unit.
 */
import type { Ability, Cost } from "@rift/protocol";
import { registerCardScript } from "../registry";
import { SELF, WHEN_PLAYED, aUnit, custom } from "../dsl";

const HOST = { targetRef: "host" } as const;

/** 818.1.c.2: "Equip [Cost]" = "[Cost]: Attach this gear to a unit you control." */
export function equip(cost: Cost): Ability {
  return {
    kind: "activated",
    cost,
    keywords: ["Equip"],
    name: "Equip",
    effect: { op: "attach", gear: SELF, to: aUnit({ controller: "self" }) },
  };
}

registerCardScript({
  name: "Sumpworks Map",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\n[Temporary] (Kill this at the start of its controller's Beginning Phase, before scoring.)\nWhen an opponent scores, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "score", player: "opponent" } },
      effect: { op: "draw", amount: 1 },
    },
  ],
});

registerCardScript({
  name: "Shepherd's Heirloom",
  text: "When you play this, gain 1 XP.\n[Equip] — Spend 1 XP (Pay the cost: Attach this to a unit you control.)",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "gain_xp", amount: 1 } },
    equip({ spendXp: 1 }),
  ],
});

registerCardScript({
  name: "Hunter's Machete",
  text: "[Equip][Body] ([Body]: Attach this to a unit you control.)\n[Hunt] (When I conquer or hold, gain 1 XP)\n+2 [Might]",
  status: "implemented",
  abilities: [
    equip({ power: { Body: 1 } }),
    { kind: "suppress-printed-keyword", keyword: "Hunt" },
    { kind: "passive", modifier: { kind: "keyword", keyword: "Hunt", target: HOST } },
    { kind: "passive", modifier: { kind: "might", amount: 2, target: HOST } },
  ],
});

registerCardScript({
  name: "Soul Sword",
  text: "[Equip] [calm] ([calm] : Attach this to a unit you control.)\n[level 3] I have an additional +1 [might] .\n(While you have 3+ XP, get the effect.)\n+1 [Might]",
  status: "implemented",
  abilities: [
    equip({ power: { Calm: 1 } }),
    { kind: "passive", modifier: { kind: "might", amount: 1, target: HOST } },
    {
      kind: "passive",
      modifier: {
        kind: "custom",
        id: "conditional",
        params: {
          condition: custom("xp-at-least", { n: 3 }),
          modifier: { kind: "might", amount: 1, target: HOST },
        },
      },
    },
  ],
});

registerCardScript({
  name: "Fresh Beans",
  text: "When you play a unit during a showdown, you may exhaust this to draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "unit_played", player: "self", condition: custom("unl:in-showdown") },
      },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { exhaust: SELF },
        effect: { op: "draw", amount: 1 },
      },
    },
  ],
});

registerCardScript({
  name: "Blood Rose",
  text: "When you play a unit, you may pay [1] to gain 1 XP.\nSpend 3 XP, [tap] : Ready a unit.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "unit_played", player: "self" } },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "gain_xp", amount: 1 },
      },
    },
    {
      kind: "activated",
      cost: { spendXp: 3, exhaust: SELF },
      effect: { op: "ready", target: aUnit() },
    },
  ],
});
