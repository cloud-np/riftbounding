/**
 * Unleashed units with conquer / hold / attack / defend triggers (383.4.c–f; "here" = my
 * location, 359.3.f):
 *
 * - Inviolus Vox (UNL-027): When I conquer, give a friendly unit +8 [Might] this turn.
 * - Vi, Peacekeeper (UNL-176): [Ambush]; When I attack, [Stun] an enemy unit here.
 * - Trevor Snoozebottom (UNL-048): [Shield]; When I hold, play a ready 3 [Might] Sprite here (its
 *   [Temporary] is the catalog token's; the catalog's [Temporary] on Trevor is suppressed).
 * - Yuumi, Magical Cat (UNL-056): When I attack or defend, give one of your other units here +3
 *   [Might] and [Tank] this turn (Yuumi herself has no [Tank]; suppressed).
 * - Kha'Zix, Mutating Horror (UNL-143): [Ambush]; When I attack or defend, if an enemy unit is
 *   alone here (part of the trigger condition, 383.2.a.1 / 383.4.e.2.b), +2 [Might] this turn
 *   and gain 2 XP.
 * - Kha'Zix, Evolving Hunter (UNL-119): [Hunt]; When I attack, you may spend 3 XP to deal damage
 *   equal to my Might to an enemy unit here (740.4.a "[cost] to [effect]").
 * - Icevale Archer (UNL-065): When I attack, you may pay [1] to give a unit here -1 [Might].
 * - Sinister Poro (UNL-137): When I attack, you may pay [1] to move an enemy unit here to its base.
 */
import type { Trigger } from "@rift/protocol";
import { registerCardScript } from "../registry";
import { HERE, SELF, aUnit, custom, token } from "../dsl";

const WHEN_I_ATTACK: Trigger = { kind: "event", event: { type: "attack", subject: SELF } };
const WHEN_I_ATTACK_OR_DEFEND: Trigger = {
  kind: "event",
  event: { type: ["attack", "defend"], subject: SELF },
};
const ENEMY_HERE = aUnit({ controller: "opponent", zone: HERE });

registerCardScript({
  name: "Inviolus Vox",
  text: "When I conquer, give a friendly unit +8 [might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "conquer", subject: SELF } },
      effect: { op: "temporary_might", amount: 8, target: aUnit({ controller: "self" }) },
    },
  ],
});

registerCardScript({
  name: "Vi, Peacekeeper",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nWhen I attack, [Stun] an enemy unit here. (It doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [
    { kind: "keyword", keyword: "Reaction", value: 0 },
    { kind: "triggered", trigger: WHEN_I_ATTACK, effect: { op: "stun", target: ENEMY_HERE } },
  ],
});

registerCardScript({
  name: "Trevor Snoozebottom",
  text: "[shield] (+1 [Might] while I'm a defender.)\nWhen I hold, play a ready 3 [might] Sprite unit token with [temporary] here. (Kill it at the start of its controller's next Beginning Phase, before scoring.)",
  status: "implemented",
  abilities: [
    { kind: "keyword", keyword: "Temporary", value: 0 },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "hold", subject: SELF } },
      effect: {
        op: "create",
        token: token("Sprite", { might: 3, exhausted: false, play: true }),
        zone: HERE,
      },
    },
  ],
});

registerCardScript({
  name: "Yuumi, Magical Cat",
  text: "When I attack or defend, give one of your other units here +3[Might] and [Tank] this turn. (It must be assigned combat damage first.)",
  status: "implemented",
  abilities: [
    { kind: "keyword", keyword: "Tank", value: 0 },
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK_OR_DEFEND,
      effect: {
        op: "seq",
        effects: [
          {
            op: "temporary_might",
            amount: 3,
            target: aUnit({
              controller: "self",
              zone: HERE,
              excludeSource: true,
              targetRef: "target:0",
            }),
          },
          {
            op: "grant_keyword",
            keyword: "Tank",
            target: { targetRef: "target:0" },
            duration: "this-turn",
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Kha'Zix, Mutating Horror",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nWhen I attack or defend, if an enemy unit is alone here, give me +2 [Might] this turn and gain 2 XP.",
  status: "implemented",
  abilities: [
    { kind: "keyword", keyword: "Reaction", value: 0 },
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK_OR_DEFEND,
      condition: custom("unl:enemy-alone-here"),
      effect: {
        op: "seq",
        effects: [
          { op: "temporary_might", amount: 2, target: SELF },
          { op: "gain_xp", amount: 2 },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Kha'Zix, Evolving Hunter",
  text: "[Hunt] (When I conquer or hold, gain 1 XP.)\nWhen I attack, you may spend 3 XP to deal damage equal to my Might to an enemy unit here.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { spendXp: 3 },
        effect: {
          op: "deal",
          amount: { kind: "might", selector: SELF },
          target: ENEMY_HERE,
          source: SELF,
        },
      },
    },
  ],
});

registerCardScript({
  name: "Icevale Archer",
  text: "When I attack, you may pay [1] to give a unit here -1[Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "temporary_might", amount: -1, target: aUnit({ zone: HERE }) },
      },
    },
  ],
});

registerCardScript({
  name: "Sinister Poro",
  text: "When I attack, you may pay [1] to move an enemy unit here to its base.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "move", target: ENEMY_HERE, to: "base" },
      },
    },
  ],
});
