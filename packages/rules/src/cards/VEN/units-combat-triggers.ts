/**
 * Vendetta units with attack / conquer / hold / death triggers (383.4.c–f).
 */
import { registerCardScript } from "../registry";
import { HERE, SELF, aUnit, custom, not } from "../dsl";
import {
  WHEN_I_ATTACK,
  WHEN_I_CONQUER,
  WHEN_I_HOLD,
  conditional,
  notIntrinsic,
  runesControlled,
} from "./shared";

const EXACTLY_ONE_OTHER_HERE = custom("ven:exactly-one-other-friendly-here");

registerCardScript({
  name: "Twilight Reveler",
  text: "When I attack, ready another friendly unit.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: { op: "ready", target: aUnit({ controller: "self", excludeSource: true }) },
    },
  ],
});

registerCardScript({
  name: "Shen, Scourge of Shadows",
  text: "When I hold, if there is exactly one other unit you control here, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_HOLD,
      condition: EXACTLY_ONE_OTHER_HERE,
      effect: { op: "draw", amount: 1 },
    },
  ],
});

registerCardScript({
  name: "Shen, Leader of the Kinkou Order",
  text: "[Shield] (+1 [Might] while I'm a defender.)\nWhen I hold, if there is exactly one other unit you control here, you score 1 point.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_HOLD,
      condition: EXACTLY_ONE_OTHER_HERE,
      effect: { op: "score_points", amount: 1 },
    },
  ],
});

registerCardScript({
  name: "Nasus, Guardian of Knowledge",
  text: "Once each turn, when an enemy unit here dies, channel 1 rune exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      // The kill event's zone is where the unit died (383.2.c.3.b noted information).
      trigger: {
        kind: "event",
        event: { type: "die", zone: HERE, subject: { cardType: "unit", controller: "opponent" } },
      },
      limit: { kind: "once-per-turn" },
      effect: { op: "channel", amount: 1, exhausted: true },
    },
  ],
});

registerCardScript({
  name: "Noxian Demolitionist",
  text: "When I conquer, you may kill a gear with Energy cost no more than my Might.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_CONQUER,
      optional: true,
      effect: {
        op: "kill",
        target: {
          chosen: true,
          cardType: "gear",
          energyCost: { op: "lte", value: { kind: "might", selector: SELF } },
        },
      },
    },
  ],
});

registerCardScript({
  name: "Renekton, Rage Fueled",
  text: "[Accelerate] (You may pay [1][Fury] as an additional cost to have me enter ready.)\nWhen I attack, if you control 4 or fewer runes, deal 2 to all enemy units here.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      condition: runesControlled("lte", 4),
      effect: {
        op: "deal",
        amount: 2,
        target: { cardType: "unit", controller: "opponent", zone: HERE },
      },
    },
  ],
});

registerCardScript({
  name: "Baccai Reaper",
  text: "When I attack, you may pay [Fury] to give me [Assault 2] this turn. (+2 [Might] while I'm an attacker.)",
  status: "implemented",
  abilities: [
    // The catalog's Assault is only granted by the trigger (727.1.b).
    ...notIntrinsic("Assault"),
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      // 740.4.a.2 / 383.3.b: a leading cost within instructions, paid when the trigger finalizes.
      effect: {
        op: "cost_then",
        optional: true,
        cost: { power: { Fury: 1 } },
        effect: { op: "grant_keyword", keyword: "Assault", value: 2, target: SELF, duration: "this-turn" },
      },
    },
  ],
});

registerCardScript({
  name: "Kennen, Keeper of Balance",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nWhen you play me or I attack, you may pay [2] to [Stun] a unit. (It doesn't deal combat damage this turn.)\nWhile there's a stunned enemy unit here, I have +2 [Might].",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: ["unit_played", "attack"], subject: SELF } },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 2 },
        effect: { op: "stun", target: aUnit() },
      },
    },
    conditional(
      {
        kind: "exists",
        selector: { cardType: "unit", controller: "opponent", stunned: true, zone: HERE },
      },
      { kind: "might", amount: 2, target: SELF },
    ),
  ],
});

registerCardScript({
  name: "Corrupted Dragon",
  text: "If your score is not within 3 points of the Victory Score, I enter ready.\nWhen I attack, you may move any number of enemy units here each with 5 [Might] or less to their base.",
  status: "implemented",
  abilities: [
    conditional(not(custom("ven:score-within", { points: 3 })), {
      kind: "custom",
      id: "enter-ready",
      params: { target: SELF },
    }),
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: {
        op: "move",
        target: aUnit({
          controller: "opponent",
          zone: HERE,
          might: { op: "lte", value: 5 },
          maxCount: 99,
        }),
        to: "base",
      },
    },
  ],
});
