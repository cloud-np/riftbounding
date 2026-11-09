/**
 * Unleashed units (misc. triggers and optional additional costs):
 *
 * - Enthusiastic Promoter (UNL-043): [Backline] (826, read from the printed line by R2-combat);
 *   when I hold, [Buff] all units here.
 * - Pyke, Returned (UNL-145): [Hidden] (811), [Backline]; once each turn (383.3.e), when an enemy
 *   unit dies while I'm at a battlefield, play a Gold gear token exhausted. The catalog's
 *   [Reaction]/[Add] are the Gold token's reminder text (suppressed).
 * - Pyke, Dockside Butcher (UNL-028): [Hidden], [Ganking]; optional additional cost [Fury]
 *   (R2-play parses it, 356.2.b.1); play effect if paid: ready me and +2 [Might] this turn.
 * - Nami, Headstrong (UNL-052): optional additional cost [Calm]; play effect if paid: [Stun] an
 *   enemy unit; when I hold, the next time you play a unit this turn, ready it and [Buff] it (392).
 * - Master Yi, Unstoppable (UNL-059): [Level 3/6/11] I cost [2][Calm] / [4][Calm][Calm] /
 *   [6][Calm][Calm][Calm] less ("instead": one applies, 366.2.a from the hand); [Level 16] I can't
 *   be chosen by enemy spells and abilities (757.1).
 * - Scuttle Crab (UNL-053): play effect draw 1; [Deathknell]: an opponent reveals their hand,
 *   gain 1 XP.
 */
import type { Ability, Condition, Modifier } from "@rift/protocol";
import { registerCardScript } from "../registry";
import {
  EVENT_SUBJECT,
  HERE,
  PAID_ADDITIONAL,
  SELF,
  SELF_AT_BATTLEFIELD,
  WHEN_I_DIE,
  WHEN_PLAYED,
  aUnit,
  custom,
  not,
  token,
} from "../dsl";
import { WHEN_I_HOLD } from "../lib/triggers";
import { xpAtLeast } from "../lib/conditions";
import { whilePassive } from "../lib/passives";


registerCardScript({
  name: "Enthusiastic Promoter",
  text: "[Backline] (I must be assigned combat damage last.)\nWhen I hold, [Buff] all units here. (Give each a +1 [might] buff if it doesn't have one.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_HOLD,
      effect: { op: "buff", target: { cardType: "unit", zone: HERE, all: true } },
    },
  ],
});

registerCardScript({
  name: "Pyke, Returned",
  text: '[Hidden] (Hide now for [Rune] to react with later for [0].)\n[Backline] (I must be assigned combat damage last.)\nOnce each turn, when an enemy unit dies while I\'m at a battlefield, play a Gold gear token exhausted. (It has "[Reaction] Kill this, [Tap]: [Add] [Rune].")',
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    { kind: "suppress-printed-keyword", keyword: "Add" },
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "die", subject: { cardType: "unit", controller: "opponent" } },
      },
      condition: SELF_AT_BATTLEFIELD,
      limit: { kind: "once-per-turn" },
      effect: { op: "create", token: token("Gold", { exhausted: true, play: true }) },
    },
  ],
});

registerCardScript({
  name: "Pyke, Dockside Butcher",
  text: "[Hidden] (Hide it now for [rune] to react with later for [0] .)\n[Ganking] (I can move from battlefield to battlefield.)\nYou may pay [fury] as an additional cost to play me.\nWhen you play me, if you paid the additional cost, ready me and give me +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: {
        op: "seq",
        effects: [
          { op: "ready", target: SELF },
          { op: "temporary_might", amount: 2, target: SELF },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Nami, Headstrong",
  text: "You may pay [Calm] as an additional cost to play me.\nWhen you play me, if you paid the additional cost, [Stun] an enemy unit. (It doesn't deal combat damage this turn.)\nWhen I hold, the next time you play a unit this turn, ready it and [Buff] it.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: { op: "stun", target: aUnit({ controller: "opponent" }) },
    },
    {
      kind: "triggered",
      trigger: WHEN_I_HOLD,
      effect: {
        op: "delayed",
        trigger: { kind: "event", event: { type: "unit_played", player: "self" } },
        effect: {
          op: "seq",
          effects: [
            { op: "ready", target: EVENT_SUBJECT },
            { op: "buff", target: EVENT_SUBJECT },
          ],
        },
        once: true,
        duration: "this-turn",
      },
    },
  ],
});

const level = xpAtLeast;

function costLess(condition: Condition, energy: number, calm: number): Ability {
  return whilePassive(condition, { kind: "cost-adjust", energy: -energy, power: { Calm: -calm }, target: SELF });
}

registerCardScript({
  name: "Master Yi, Unstoppable",
  text: "[Level 3] I cost [2] [calm] less. (While you have 3+ XP, get the effect.)\n[Level 6] I cost [4] [calm] [calm] less instead.\n[Level 11] I cost [6] [calm] [calm] [calm] less instead.\n[Level 16] I can't be chosen by enemy spells and abilities.",
  status: "implemented",
  abilities: [
    costLess({ kind: "and", conditions: [level(3), not(level(6))] }, 2, 1),
    costLess({ kind: "and", conditions: [level(6), not(level(11))] }, 4, 2),
    costLess(level(11), 6, 3),
    {
      kind: "passive",
      modifier: { kind: "while", condition: level(16), modifier: { kind: "restriction", restriction: "be-targeted:enemy", target: SELF } },
    },
  ],
});

registerCardScript({
  name: "Scuttle Crab",
  text: "(Units with 0 [might] can conquer and hold)\nWhen you play me draw 1.\n[Deathknell] Choose an opponent. They reveal their hand. You can look at their facedown cards this turn. Gain 1 XP. (When i die, get the effect.)",
  status: "partial",
  notes:
    "'You can look at their facedown cards this turn' (an information permission, 107.3.c) is not modelled; in 3+ player games every opponent reveals instead of one chosen opponent (the reveal op has no player choice, 355.7).",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "draw", amount: 1 } },
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: {
        op: "seq",
        effects: [
          { op: "reveal", target: { zone: "hand", controller: "opponent", all: true } },
          { op: "gain_xp", amount: 1 },
        ],
      },
    },
  ],
});
