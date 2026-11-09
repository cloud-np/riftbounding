/**
 * Radiance (RAD) gear (wave R3). [Deploy] (830), [Equip] (818, the play layer's built-in
 * `equip:<n>` ability) and [Quick-Draw] (819) are engine keywords; an Equipment's effect text
 * ("[Shield 2]", "+1 [Might]") is written as passives targeting the host (718.3 / 718.4).
 */
import type { Effect, Selector } from "@rift/protocol";
import { registerCardScript } from "../registry";
import {
  HERE,
  SELF,
  WHEN_I_BECOME_EXHAUSTED,
  WHEN_I_DIE,
  WHEN_I_MOVE,
  WHEN_PLAYED,
  WHEN_YOU_CONQUER_HERE,
  WHEN_YOU_HOLD_HERE,
  aUnit,
  custom,
  token,
} from "../dsl";
import { UNIT_OR_GEAR, notIntrinsic } from "./dsl";

const HOST = { targetRef: "host" } as const;
const FRIENDLY_UNITS_HERE: Selector = { cardType: "unit", controller: "self", zone: HERE };

/** Banner of Conquest (RAD-002) — "[Deploy] Friendly units here have [Assault]." (807, 801.3) */
registerCardScript({
  name: "Banner of Conquest",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nFriendly units here have [Assault]. (+1 [Might] while they're attackers.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Assault"),
    {
      kind: "passive",
      modifier: { kind: "keyword", keyword: "Assault", target: FRIENDLY_UNITS_HERE },
    },
  ],
});

/** Blossoming Dreamroot (RAD-024) — "[Deploy] When you win a combat here, draw 1." (468.3 combat result) */
registerCardScript({
  name: "Blossoming Dreamroot",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhen you win a combat here, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "combat_result", zone: HERE, player: "self" } },
      effect: { op: "draw", amount: 1 },
    },
  ],
});

/**
 * Concert Poster (RAD-116) — "[Deploy] When you play this or when you conquer here, you may pay
 * [1] to play a 1 [Might] Recruit unit token to your base." (740.4.a cost within instructions)
 */
const POSTER_EFFECT: Effect = {
  op: "cost_then",
  cost: { energy: 1 },
  optional: true,
  effect: { op: "create", token: token("Recruit", { might: 1, play: true }), zone: "base" },
};
registerCardScript({
  name: "Concert Poster",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhen you play this or when you conquer here, you may pay [1] to play a 1 [Might] Recruit unit token to your base.",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: POSTER_EFFECT },
    { kind: "triggered", trigger: WHEN_YOU_CONQUER_HERE, effect: POSTER_EFFECT },
  ],
});

/**
 * Demacian Standard (RAD-156) — "[Deploy] When one or more friendly units attack here, give one of
 * them +2 [Might] this turn. When you hold here, you may return this to its owner's hand."
 * "One or more friendly units attack here" is the player-level attack event (383.4.e, 466.2.c.3).
 */
registerCardScript({
  name: "Demacian Standard",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhen one or more friendly units attack here, give one of them +2 [Might] this turn.\nWhen you hold here, you may return this to its owner's hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "attack", zone: HERE, player: "self", data: { player: true } },
      },
      effect: {
        op: "temporary_might",
        amount: 2,
        target: aUnit({ controller: "self", zone: HERE, where: custom("rad:is-attacker") }),
      },
    },
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      effect: { op: "may", effect: { op: "return_to_hand", target: SELF } },
    },
  ],
});

/** Ephemeral Ward (RAD-039) — "Your units have +2 [Might]. When you play a unit, kill this." (440.2.c: tokens are played too) */
registerCardScript({
  name: "Ephemeral Ward",
  text: "Your units have +2 [Might].\nWhen you play a unit, kill this.",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "might", amount: 2, target: { cardType: "unit", controller: "self" } },
    },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "unit_played", player: "self" } },
      effect: { op: "kill", target: SELF },
    },
  ],
});

/**
 * Hunting Blind (RAD-044) — "[Deploy] When you play this, you may move an enemy unit to this
 * battlefield. Friendly units here have [Shield 2]."
 */
registerCardScript({
  name: "Hunting Blind",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhen you play this, you may move an enemy unit to this battlefield.\nFriendly units here have [Shield 2]. (+2[Might] while they're defenders.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Shield"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "may",
        effect: { op: "move", target: aUnit({ controller: "opponent" }), to: HERE },
      },
    },
    {
      kind: "passive",
      modifier: { kind: "keyword", keyword: "Shield", value: 2, target: FRIENDLY_UNITS_HERE },
    },
  ],
});

/**
 * Invigorating Bloom (RAD-035) — "When you play this, give a friendly unit +3 [Might] this turn.
 * Exhaust a friendly [Mighty] unit, [Tap]: Draw 1."
 */
registerCardScript({
  name: "Invigorating Bloom",
  text: "When you play this, give a friendly unit +3 [Might] this turn.\nExhaust a friendly [Mighty] unit, [Tap]: Draw 1. (A unit is Mighty while it has 5+ [Might].)",
  status: "partial",
  notes:
    "The activated ability's cost exhausts two objects (a friendly Mighty unit and this); `Cost.exhaust` holds one selector (357.2).",
  abilities: [
    ...notIntrinsic("Mighty"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "temporary_might", amount: 3, target: aUnit({ controller: "self" }) },
    },
  ],
});

/** Nazuman Ntofo (RAD-071) — "[Equip][1] [Shield 2] +0 [Might]" (818; effect text 718.3/718.4) */
registerCardScript({
  name: "Nazuman Ntofo",
  text: "[Equip][1] ([1]: Attach this to a unit you control.)\n[Shield 2] (+2 [Might] while I'm a defender.)\n+0 [Might]",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Shield"),
    { kind: "passive", modifier: { kind: "keyword", keyword: "Shield", value: 2, target: HOST } },
  ],
});

/** Pillaged Armory (RAD-073) — "[Deploy] When you play this or when you conquer here, [Buff] a friendly unit." */
const BUFF_FRIENDLY: Effect = { op: "buff", target: aUnit({ controller: "self" }) };
registerCardScript({
  name: "Pillaged Armory",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhen you play this or when you conquer here, [Buff] a friendly unit. (Give it a +1[Might] buff if it doesn't have one.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Buff"),
    { kind: "triggered", trigger: WHEN_PLAYED, effect: BUFF_FRIENDLY },
    { kind: "triggered", trigger: WHEN_YOU_CONQUER_HERE, effect: BUFF_FRIENDLY },
  ],
});

/** Portable Portal (RAD-087) — "[Deploy] When you play this, you may pay [Body] to ready a unit here. Friendly units here have [Ganking]." */
registerCardScript({
  name: "Portable Portal",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhen you play this, you may pay [Body] to ready a unit here.\nFriendly units here have [Ganking]. (They can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Ganking"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "cost_then",
        cost: { power: { Body: 1 } },
        optional: true,
        effect: { op: "ready", target: aUnit({ zone: HERE }) },
      },
    },
    {
      kind: "passive",
      modifier: { kind: "keyword", keyword: "Ganking", target: FRIENDLY_UNITS_HERE },
    },
  ],
});

/** Protector's Shield (RAD-123) — "[Quick-Draw] [Equip] [1] [Tank] +1 [Might]" (819, 818; effect text 718.3/718.4) */
registerCardScript({
  name: "Protector's Shield",
  text: "[Quick-Draw] (This has [Reaction]. When you play it, attach it to a unit you control.)\n[Equip] [1] ([1]: Attach this to a unit you control.)\n[Tank] (I must be assigned combat damage first.)\n+1 [Might]",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Tank"),
    { kind: "passive", modifier: { kind: "keyword", keyword: "Tank", target: HOST } },
    { kind: "passive", modifier: { kind: "might", amount: 1, target: HOST } },
  ],
});

/**
 * Resource Extractor (RAD-052) — "[Deploy] At the end of your turn, if you control this
 * battlefield, play a Gold gear token exhausted." (383.2.a.1: the "if" is part of the trigger)
 */
registerCardScript({
  name: "Resource Extractor",
  text: '[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nAt the end of your turn, if you control this battlefield, play a Gold gear token exhausted. (It has "[Reaction] Kill this, [Tap]: [Add] [Rune].")',
  status: "implemented",
  abilities: [
    ...notIntrinsic("Reaction", "Add"),
    {
      kind: "triggered",
      trigger: { kind: "turn-end" },
      condition: custom("rad:control-here"),
      effect: {
        op: "if",
        condition: custom("rad:control-here"),
        then: { op: "create", token: token("Gold", { exhausted: true, play: true }) },
      },
    },
  ],
});

/** Resplendent Rostrum (RAD-046) — "[Tap]: Draw 1 and channel 1 rune exhausted. When this becomes exhausted, give a friendly unit +3 [Might] this turn." */
registerCardScript({
  name: "Resplendent Rostrum",
  text: "[Tap]: Draw 1 and channel 1 rune exhausted.\nWhen this becomes exhausted, give a friendly unit +3 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: {
        op: "seq",
        effects: [
          { op: "draw", amount: 1 },
          { op: "channel", amount: 1, exhausted: true },
        ],
      },
    },
    {
      kind: "triggered",
      trigger: WHEN_I_BECOME_EXHAUSTED,
      effect: { op: "temporary_might", amount: 3, target: aUnit({ controller: "self" }) },
    },
  ],
});

/**
 * The Ball (RAD-146) — "[Deploy] [Ganking] When you play or move this, choose one — • Draw 1.
 * • Deal 2 to enemy units here." (355.3 / 403.2: the mode is chosen when the trigger finalizes)
 */
const BALL_MODES: Effect = {
  op: "choose_mode",
  modes: [
    { id: "draw", label: "Draw 1", effect: { op: "draw", amount: 1 } },
    {
      id: "deal",
      label: "Deal 2 to enemy units here",
      effect: {
        op: "deal",
        amount: 2,
        target: { cardType: "unit", controller: "opponent", zone: HERE },
      },
    },
  ],
};
registerCardScript({
  name: "The Ball",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\n[Ganking] (While this is a unit, it can move from battlefield to battlefield.)\nWhen you play or move this, choose one —\n• Draw 1.\n• Deal 2 to enemy units here.",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: BALL_MODES },
    { kind: "triggered", trigger: WHEN_I_MOVE, effect: BALL_MODES },
  ],
});

/** The Good Stuff (RAD-106) — "[Deploy] When you play this, discard 1, then draw 3. When you hold here, return this to its owner's hand." */
registerCardScript({
  name: "The Good Stuff",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhen you play this, discard 1, then draw 3.\nWhen you hold here, return this to its owner's hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          { op: "discard", amount: 1 },
          { op: "draw", amount: 3 },
        ],
      },
    },
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      effect: { op: "return_to_hand", target: SELF },
    },
  ],
});

/**
 * Whirling Twirligig (RAD-022) — "[Tap]: Play a Gold gear token exhausted. / Kill a friendly gear,
 * [Tap]: Play a 1 [Might] Recruit unit token. / Kill a friendly unit, [Tap]: Play a 3 [Might] Mech
 * unit token." (357.2: the kill cost chooses among candidates)
 */
registerCardScript({
  name: "Whirling Twirligig",
  text: '[Tap]: Play a Gold gear token exhausted. (It has "[Reaction] Kill this, [Tap]: [Add] [Rune].")\nKill a friendly gear, [Tap]: Play a 1 [Might] Recruit unit token.\nKill a friendly unit, [Tap]: Play a 3 [Might] Mech unit token.',
  status: "implemented",
  abilities: [
    ...notIntrinsic("Reaction", "Add"),
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: { op: "create", token: token("Gold", { exhausted: true, play: true }) },
    },
    {
      kind: "activated",
      cost: { exhaust: SELF, kill: { cardType: "gear", controller: "self" } },
      effect: { op: "create", token: token("Recruit", { might: 1, play: true }) },
    },
    {
      kind: "activated",
      cost: { exhaust: SELF, kill: { cardType: "unit", controller: "self" } },
      effect: { op: "create", token: token("Mech", { might: 3, play: true }) },
    },
  ],
});

/**
 * Titanic Shrine (RAD-089) — "When you play a unit with Might greater than each other unit on the
 * board, exhaust me to draw 1." (383.3.b: the leading cost is paid or declined on finalization)
 */
registerCardScript({
  name: "Titanic Shrine",
  text: "When you play a unit with Might greater than each other unit on the board, exhaust me to draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "unit_played",
          player: "self",
          condition: custom("rad:event-unit-mightiest"),
        },
      },
      effect: { op: "cost_then", cost: { exhaust: SELF }, effect: { op: "draw", amount: 1 } },
    },
  ],
});

/**
 * Gravity Field (RAD-062) — "[Deploy] Opponents must pay [1] [Rune] to move one or more units to
 * this battlefield. [Deathknell] Draw 1."
 */
registerCardScript({
  name: "Gravity Field",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nOpponents must pay [1] [Rune] to move one or more units to this battlefield.\n[Deathknell] Draw 1. (When I die, get the effect.)",
  status: "partial",
  notes:
    "The move tax (opponents pay [1][Rune] to move units here) needs applied costs on moves (204.4, 449).",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: { op: "draw", amount: 1 },
    },
  ],
});

/**
 * Detonation Amplifier (RAD-017) — "[Deploy] When you play this, you may kill another friendly unit
 * or gear to draw 1. Friendly [Deathknell] effects here trigger an additional time."
 */
registerCardScript({
  name: "Detonation Amplifier",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhen you play this, you may kill another friendly unit or gear to draw 1.\nFriendly [Deathknell] effects here trigger an additional time.",
  status: "partial",
  notes:
    '"Friendly [Deathknell] effects here trigger an additional time" needs trigger-count modification (808, 383).',
  abilities: [
    ...notIntrinsic("Deathknell"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "may",
        effect: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "victim",
              selector: { controller: "self", excludeSource: true, where: UNIT_OR_GEAR },
            },
            { op: "kill", target: { targetRef: "victim" } },
            { op: "if", condition: custom("did"), then: { op: "draw", amount: 1 } },
          ],
        },
      },
    },
  ],
});

/** Mechanical Bandit (RAD-111) — "At the start of your Beginning Phase, each player reveals …" (315.2.a.1, 425, 417) */
registerCardScript({
  name: "Mechanical Bandit",
  text: "At the start of your Beginning Phase, each player reveals the top card of their Main Deck. If you revealed a card with the lowest Energy cost, draw it. Recycle the rest.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "beginning" },
      effect: { op: "custom", id: "rad:mechanical-bandit" },
    },
  ],
});

/**
 * Zero Point Inflection (RAD-069) — "When you play a card, draw 2. When you draw 1 or more cards
 * with 9 or more other cards in your hand, discard your hand, kill this, and choose an opponent.
 * They score 1 point." (420.4.a; tokens are not cards, 185)
 */
registerCardScript({
  name: "Zero Point Inflection",
  text: "When you play a card, draw 2.\nWhen you draw 1 or more cards with 9 or more other cards in your hand, discard your hand, kill this, and choose an opponent. They score 1 point.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "played", player: "self", condition: custom("rad:event-not-token") },
      },
      effect: { op: "draw", amount: 2 },
    },
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "draw",
          player: "self",
          condition: custom("rad:other-cards-in-hand-gte", { n: 9 }),
        },
      },
      effect: {
        op: "seq",
        effects: [
          { op: "discard", amount: { kind: "cards-in-hand" } },
          { op: "kill", target: SELF },
          { op: "score_points", amount: 1, player: { kind: "chosen", ref: "opponent" } },
        ],
      },
    },
  ],
});

/**
 * Runeblade Anvil (RAD-012) — "When you play this or when this leaves the board, banish the top
 * card of your Main Deck. Until your next Ending Phase, you may play that card. (You still pay its
 * costs.) [2] [Fury], [Tap]: Kill this." (428, 420.1.a permission; 383.2.c.3 leave-the-board)
 */
const ANVIL_EFFECT: Effect = {
  op: "look",
  amount: 1,
  then: {
    op: "seq",
    effects: [
      { op: "banish", target: { targetRef: "looked" } },
      { op: "custom", id: "rad:may-play-until-ending", params: { ref: "looked" } },
    ],
  },
};
registerCardScript({
  name: "Runeblade Anvil",
  text: "When you play this or when this leaves the board, banish the top card of your Main Deck. Until your next Ending Phase, you may play that card. (You still pay its costs.)\n[2] [Fury], [Tap]: Kill this.",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: ANVIL_EFFECT },
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: ["kill", "banish", "return_to_hand", "recycle"], subject: SELF },
      },
      effect: ANVIL_EFFECT,
    },
    {
      kind: "activated",
      cost: { energy: 2, power: { Fury: 1 }, exhaust: SELF },
      effect: { op: "kill", target: SELF },
    },
  ],
});

/**
 * Dockside Lock-Up (RAD-136) — "[Deploy] When you play this, banish a unit here. When you hold
 * here, kill this to play the banished card, ignoring its cost. (Tokens aren't cards.)"
 * The two abilities are linked (the banished card is remembered for this object); the kill is the
 * hold trigger's leading cost (383.3.b, 405.2: it may be declined).
 */
registerCardScript({
  name: "Dockside Lock-Up",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhen you play this, banish a unit here.\nWhen you hold here, kill this to play the banished card, ignoring its cost. (Tokens aren't cards.)",
  status: "partial",
  notes:
    "The banished card is played by the play op, which puts a unit at its controller's base (no location choice, 355.2 / 420.3.b).",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          { op: "banish", target: aUnit({ zone: HERE, targetRef: "target:0" }) },
          { op: "custom", id: "rad:link-cards", params: { ref: "target:0", key: "dockside" } },
        ],
      },
    },
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      effect: {
        op: "cost_then",
        cost: { kill: SELF },
        effect: {
          op: "seq",
          effects: [
            { op: "custom", id: "rad:bind-linked", params: { key: "dockside", as: "linked" } },
            { op: "play", target: { targetRef: "linked" }, cost: "ignored" },
          ],
        },
      },
    },
  ],
});
