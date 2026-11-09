/**
 * Radiance (RAD) units with keyword-only text or a single simple ability (wave R3).
 *
 * Printed keywords (Disarm 831, Assault 807, Shield 814, Tank 815, Ganking 810, Deflect 809,
 * Accelerate 805, Deathknell 808, Hidden 811) are the engine's; scripts only add the other lines.
 */
import { ENTER_READY, conditional, notIntrinsic } from "./dsl";
import { aUnit, HERE, registerCardScript, SELF, token, WHEN_I_BECOME_EXHAUSTED, WHEN_I_DIE, WHEN_PLAYED } from "../sdk";

/** Trinket Peddler (RAD-054) — "[Disarm]" (831). */
registerCardScript({
  name: "Trinket Peddler",
  text: "[Disarm] (When I attack, give an enemy unit here -1 [Might] this turn.)",
  status: "implemented",
  abilities: [],
});

/** Staunch Survivor (RAD-088) — "[Assault 2], [Shield 2]" (807, 814). */
registerCardScript({
  name: "Staunch Survivor",
  text: "[Assault 2], [Shield 2] (+2[Might] while I'm an attacker or defender.)",
  status: "implemented",
  abilities: [],
});

/** Siren of the Shallows (RAD-097) — "[Disarm] [Ganking]" (831, 810). */
registerCardScript({
  name: "Siren of the Shallows",
  text: "[Disarm] (When I attack, give an enemy unit here -1 [Might] this turn.)\n[Ganking] (I can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [],
});

/** Wrath of the Freljord (RAD-077) — "I enter ready. [Shield 3]" (369.3, 814). */
registerCardScript({
  name: "Wrath of the Freljord",
  text: "I enter ready.\n[Shield 3] (+3 [Might] while I'm a defender.)",
  status: "implemented",
  abilities: [ENTER_READY],
});

/**
 * Disposal Expert (RAD-093) — "I enter ready if you control no other units. [Disarm 2]".
 * A conditional entry replacement (364.3.a, 369.3), checked as it enters.
 */
registerCardScript({
  name: "Disposal Expert",
  text: "I enter ready if you control no other units.\n[Disarm 2] (When I attack, give an enemy unit here -2[Might] this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: conditional(
        {
          kind: "not",
          condition: {
            kind: "exists",
            selector: { cardType: "unit", controller: "self", excludeSource: true },
          },
        },
        { kind: "enter-ready", target: SELF },
      ),
    },
  ],
});

/** Mysterious Chronomancer (RAD-050) — "When you play me, [Predict 2]. [Disarm 2]" (437, 831). */
registerCardScript({
  name: "Mysterious Chronomancer",
  text: "When you play me, [Predict 2]. (Look at the top 2 cards of your Main Deck. Recycle any of them and put the rest back in any order.)\n[Disarm 2] (When I attack, give an enemy unit here -2[Might] this turn.)",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "predict", amount: 2 } }],
});

/** K'Sante, Courageous (RAD-086) — "[Accelerate] [Shield 2] When I hold, channel 1 rune." (383.4.d.2.a, 431) */
registerCardScript({
  name: "K'Sante, Courageous",
  text: "[Accelerate] (You may pay [1] [Body] as an additional cost to have me enter ready.)\n[Shield 2] (+2 [Might] while I'm a defender.)\nWhen I hold, channel 1 rune.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "hold", subject: SELF } },
      effect: { op: "channel", amount: 1 },
    },
  ],
});

/** Strigian Oracle (RAD-053) — "When I become exhausted, [Predict]." (415, 437.3.a) */
registerCardScript({
  name: "Strigian Oracle",
  text: "When I become exhausted, [Predict]. (Look at the top card of your Main Deck. You may recycle it.)",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_I_BECOME_EXHAUSTED, effect: { op: "predict", amount: 1 } },
  ],
});

/** War Scout (RAD-008) — "[Accelerate] When you play me, give a unit +2 [Might] this turn." */
registerCardScript({
  name: "War Scout",
  text: "[Accelerate] (You may pay [1] [Fury] as an additional cost to have me enter ready.)\nWhen you play me, give a unit +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "temporary_might", amount: 2, target: aUnit() },
    },
  ],
});

/** Riptide Mage (RAD-058) — "[Accelerate] When you play me, give an enemy unit -3 [Might] this turn." */
registerCardScript({
  name: "Riptide Mage",
  text: "[Accelerate] (You may pay [1] [Mind] as an additional cost to have me enter ready.)\nWhen you play me, give an enemy unit -3 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "temporary_might", amount: -3, target: aUnit({ controller: "opponent" }) },
    },
  ],
});

/** Industrious Mechsmith (RAD-049) — "When you play me, play a 3 [Might] Mech unit token here." (440.2.c) */
registerCardScript({
  name: "Industrious Mechsmith",
  text: "When you play me, play a 3 [Might] Mech unit token here.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "create", token: token("Mech", { might: 3, play: true }), zone: HERE },
    },
  ],
});

/**
 * Antagonistic Apparatus (RAD-009) — "I enter ready. When you play me, play a ready 3 [Might]
 * Mech unit token here." (369.3, 440.2.c, 184.1)
 */
registerCardScript({
  name: "Antagonistic Apparatus",
  text: "I enter ready.\nWhen you play me, play a ready 3 [Might] Mech unit token here.",
  status: "implemented",
  abilities: [
    ENTER_READY,
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "create",
        token: token("Mech", { might: 3, exhausted: false, play: true }),
        zone: HERE,
      },
    },
  ],
});

/**
 * Sneaky Zeebles (RAD-076) — "When I conquer, [Add] [Rune]." (383.4.c.2.a, 430)
 *
 * The Add resolves through the chain like any trigger: 430.2 (triggered Add abilities finalize
 * and resolve immediately, without passing Priority) is not modelled for triggered abilities.
 */
registerCardScript({
  name: "Sneaky Zeebles",
  text: "When I conquer, [Add] [Rune]. (Abilities that add resources can't be reacted to.)",
  status: "partial",
  notes: "430.2: a triggered Add ability goes on the chain instead of resolving immediately.",
  abilities: [
    ...notIntrinsic("Add"),
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "conquer", subject: SELF } },
      effect: { op: "add", resources: { power: { any: 1 } } },
    },
  ],
});

/** Watchful Curator (RAD-037) — "Your gear have [Deflect]." (809, 801.3) It has no Deflect itself. */
registerCardScript({
  name: "Watchful Curator",
  text: "Your gear have [Deflect]. (Opponents must pay [Rune] to choose each with a spell or ability.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Deflect"),
    {
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Deflect",
        target: { cardType: "gear", controller: "self" },
      },
    },
  ],
});

/**
 * Hunting Dog (RAD-119) — "[Deathknell] Play a 1 [Might] Bird unit token with [Deflect] to your
 * base." (808, 440.2.c) The Bird token has Deflect from the token catalog (187); the Dog does not.
 */
registerCardScript({
  name: "Hunting Dog",
  text: "[Deathknell] Play a 1 [Might] Bird unit token with [Deflect] to your base. (When I die, get the effect. Opponents must pay [Rune] to choose a [Deflect] unit with a spell or ability.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Deflect"),
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: { op: "create", token: token("Bird", { might: 1, play: true }), zone: "base" },
    },
  ],
});

/**
 * Seraphine, Not Alone (RAD-SP5) — "When you play me or when I become exhausted, play a 1 [Might]
 * Recruit unit token to your base. I have +1 [Might] for each other exhausted unit you control."
 */
const RECRUIT_TO_BASE = {
  op: "create" as const,
  token: token("Recruit", { might: 1, play: true }),
  zone: "base" as const,
};
registerCardScript({
  name: "Seraphine, Not Alone",
  text: "When you play me or when I become exhausted, play a 1[Might] Recruit unit token to your base.\nI have +1[Might] for each other exhausted unit you control.",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: RECRUIT_TO_BASE },
    { kind: "triggered", trigger: WHEN_I_BECOME_EXHAUSTED, effect: RECRUIT_TO_BASE },
    {
      kind: "passive",
      modifier: {
        kind: "might",
        amount: {
          kind: "count",
          selector: { cardType: "unit", controller: "self", exhausted: true, excludeSource: true },
        },
        target: SELF,
      },
    },
  ],
});

/** Bilgewater Tracker (RAD-003) — "When you play me, deal 1 to each of up to 2 units." (355.13, 418) */
registerCardScript({
  name: "Bilgewater Tracker",
  text: "When you play me, deal 1 to each of up to 2 units.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "deal", amount: 1, target: aUnit({ maxCount: 2 }) },
    },
  ],
});

/** Suave Negotiator (RAD-099) — "When you play me, choose an opponent. You and that player each draw 1." */
registerCardScript({
  name: "Suave Negotiator",
  text: "When you play me, choose an opponent. You and that player each draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          { op: "draw", amount: 1 },
          { op: "draw", amount: 1, player: { kind: "chosen", ref: "opponent" } },
        ],
      },
    },
  ],
});

/** Stalwart Goatherd (RAD-083) — "[Shield 2] When you play me, you may kill a gear with Energy cost [4] or less." */
registerCardScript({
  name: "Stalwart Goatherd",
  text: "[Shield 2] (+2 [Might] while I'm a defender.)\nWhen you play me, you may kill a gear with Energy cost [4] or less.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "may",
        effect: {
          op: "kill",
          target: { chosen: true, cardType: "gear", energyCost: { op: "lte", value: 4 } },
        },
      },
    },
  ],
});

/** Pitiless Stalker (RAD-104) — "[Tap]: [Stun] an enemy unit." (424) */
registerCardScript({
  name: "Pitiless Stalker",
  text: "[Tap]: [Stun] an enemy unit. (It doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: { op: "stun", target: aUnit({ controller: "opponent" }) },
    },
  ],
});
