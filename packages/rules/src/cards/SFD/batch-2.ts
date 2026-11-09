/**
 * Spiritforged (SFD) — wave R3 batch 2: keyword units, Weaponmaster units, Equipment (Might
 * Bonus / effect-text keywords, 718.3–718.4), Mech lords, cost passives and Repeat spells.
 */
import type { Condition, Effect, Modifier, Selector } from "@rift/protocol";
import { registerCardScript } from "../registry";
import { EVENT_SUBJECT, SELF, WHEN_I_DIE, WHEN_I_MOVE, WHEN_PLAYED, custom } from "../dsl";
import {
  HERE_ZONE,
  WHEN_I_ATTACK_OR_DEFEND,
  WHEN_I_CONQUER,
  WHEN_I_HOLD,
  countOf,
  enterReady,
  gold,
  hostKeyword,
  mech,
  mightBonus,
  notIntrinsic,
  recruit,
  sandSoldier,
  target,
  whilePassive,
} from "./common";

const MECHS: Selector = { cardType: "unit", controller: "self", tag: "Mech" };

/** "I cost [N] less for each …" as stacked conditional discounts (356.4, 356.4.g), `steps` deep. */
function stepDiscounts(count: (k: number) => Condition, perStep: number, steps: number) {
  return Array.from({ length: steps }, (_, index) =>
    whilePassive(count(index + 1), {
      kind: "cost",
      amount: -perStep,
      target: SELF,
    } satisfies Modifier),
  );
}

/* ---------------------------------------------------------------- keyword-only units */

registerCardScript({
  name: "Laurent Bladekeeper",
  text: "[Ganking] (I can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [],
});

registerCardScript({
  name: "Laurent Duelist",
  text: "[Assault 2] (+2 [Might] while I'm an attacker.)",
  status: "implemented",
  abilities: [],
});

registerCardScript({
  name: "Navori Scout",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)",
  status: "implemented",
  abilities: [],
});

/* ---------------------------------------------------------------- Weaponmaster units */

const WEAPONMASTER_TEXT =
  "[Weaponmaster] (When you play me, you may [Equip] one of your Equipment to me for [Rune] less, even if it's already attached.)";

registerCardScript({
  name: "Combat Chef",
  text: WEAPONMASTER_TEXT,
  status: "implemented",
  abilities: [],
});

registerCardScript({
  name: "Master Bingwen",
  text: WEAPONMASTER_TEXT,
  status: "implemented",
  abilities: [],
});

registerCardScript({
  name: "Sentinel Adept",
  text: WEAPONMASTER_TEXT,
  status: "implemented",
  abilities: [],
});

registerCardScript({
  name: "Veteran poro",
  text: WEAPONMASTER_TEXT,
  status: "implemented",
  abilities: [],
});

registerCardScript({
  name: "Armed Assailant",
  text: "[Accelerate] (You may pay [1][Fury] as an additional cost to have me enter ready.)\n[Weaponmaster] (When you play me, you may [Equip] one of your Equipment to me for [Rune] less, even if it's already attached.)",
  status: "implemented",
  abilities: [],
});

/* ---------------------------------------------------------------- Equipment: Might Bonus / keywords */

registerCardScript({
  name: "B.F. Sword",
  text: "[EQUIP] [ORDER] ([ORDER]: Attach this to a unit you control.)\n\n+3 [Might]",
  status: "implemented",
  abilities: [mightBonus(3)],
});

registerCardScript({
  name: "Doran's Blade",
  text: "[Equip] [Body]  ([Body]: Attach this to a unit you control.)\n\n+2 [Might]",
  status: "implemented",
  abilities: [mightBonus(2)],
});

registerCardScript({
  name: "Doran's Shield",
  text: "[Equip][Calm]  ([Calm]: Attach this to a unit you control.)\n\n[Tank], +1 [Might]",
  status: "implemented",
  abilities: [...notIntrinsic("Tank"), hostKeyword("Tank"), mightBonus(1)],
});

registerCardScript({
  name: "Boots of Swiftness",
  text: "[Equip][Chaos] ([Chaos]: Attach this to a unit you control.)\n\n[GANKING] (I can move from battlefield to battlefield.)\n+2 [Might]",
  status: "implemented",
  abilities: [...notIntrinsic("Ganking"), hostKeyword("Ganking"), mightBonus(2)],
});

registerCardScript({
  name: "Hexdrinker",
  text: "[Equip][Body] ([Body]: Attach this to a unit you control.)\n\n[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\n+1 [Might]",
  status: "implemented",
  abilities: [...notIntrinsic("Deflect"), hostKeyword("Deflect"), mightBonus(1)],
});

registerCardScript({
  name: "Serrated Dirk",
  text: "[Equip][Fury] ([Fury]: Attach this to a unit you control.)\n\n[ASSAULT 2] (+2 [Might] while I'm an attacker.\n+0 [Might]",
  status: "implemented",
  abilities: [...notIntrinsic("Assault"), hostKeyword("Assault", 2)],
});

registerCardScript({
  name: "Blade of the Ruined King",
  text: "[Equip] — [Order], Kill a friendly unit (Pay the cost: Attach this to a unit you control.)\n\n+4 [Might]",
  status: "implemented",
  abilities: [mightBonus(4)],
});

registerCardScript({
  name: "Long Sword",
  text: "[Quick-Draw] (This has [Reaction]. When you play it, attach it to a unit you control.)\n[Equip][Fury]  ([Fury]: Attach this to a unit you control.)\n\n+2 [Might]",
  status: "implemented",
  abilities: [mightBonus(2)],
});

registerCardScript({
  name: "Sterak's Gage",
  text: "[Quick-Draw] (This has [Reaction]. When you play it, attach it to a unit you control.)\n[Equip][Calm] ([Calm]: Attach this to a unit you control.)\n\n+3 [Might]",
  status: "implemented",
  abilities: [mightBonus(3)],
});

registerCardScript({
  name: "Cloth Armor",
  text: "[Quick-Draw] (This has [Reaction]. When you play it, attach it to a unit you control.)\n[Equip][Mind] ([Mind]: Attach this to a unit you control.)\n\n[Shield 2] (+2 [Might] while I'm a defender.)\n+0 [Might]",
  status: "implemented",
  abilities: [...notIntrinsic("Shield"), hostKeyword("Shield", 2)],
});

registerCardScript({
  name: "Spinning Axe",
  text: "[Quick-Draw] (This has [Reaction]. When you play it, attach it to a unit you control.)\n[Equip] [Rune] ([Rune]: Attach this to a unit you control.)\n[Temporary] (If this is unattached, kill it at the start of its controller's Beginning Phase, before scoring.)\n\n+3 [Might]",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Temporary"),
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "beginning" },
      // 718.2: Temporary is printed Rules Text: inactive while attached (it only kills an
      // unattached gear, 816.1.b).
      condition: custom("sfd:self-unattached"),
      effect: { op: "kill", target: SELF },
    },
    mightBonus(3),
  ],
});

/* ---------------------------------------------------------------- Equipment with effect-text triggers / other text */

registerCardScript({
  name: "Boneshiver",
  text: "[EQUIP][1][Body] ([1][Body]: Attach this to a unit you control.)\n\nWhen i conquer, channel 1 rune exhausted.\n+2 [Might]",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_CONQUER,
      effect: { op: "channel", amount: 1, exhausted: true },
    },
    mightBonus(2),
  ],
});

registerCardScript({
  name: "Cull",
  text: "[Equip][Chaos] ([Chaos]: Attach this to a unit you control.)\n\nWhen I conquer, play a Gold gear token exhausted.\n+1 [Might]",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_I_CONQUER, effect: gold(1) },
    mightBonus(1),
  ],
});

registerCardScript({
  name: "Doran's Ring",
  text: "[Equip] [Chaos] ([Chaos]: Attach this to a unit you control.)-.\n\nWhen I conquer, discard 1, then draw 1.\n+1 [Might]",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_CONQUER,
      effect: {
        op: "seq",
        effects: [
          { op: "discard", amount: 1 },
          { op: "draw", amount: 1 },
        ],
      },
    },
    mightBonus(1),
  ],
});

registerCardScript({
  name: "Eye of the Herald",
  text: "[Equip][Order] ([Order]: Attach this to a unit you control.)\n\nWhen I move, play a 1 [Might] Recruit unit token here.\n+0 [Might]",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_I_MOVE, effect: recruit(HERE_ZONE) },
  ],
});

registerCardScript({
  name: "Recurve Bow",
  text: "[Equip][Fury] ([Fury]: Attach this to a unit you control.)\n\nWhen I attack or defend, deal 2 to an enemy unit here.\n+0 [Might]",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK_OR_DEFEND,
      effect: {
        op: "deal",
        amount: 2,
        target: {
          chosen: true,
          targetRef: "target:0",
          cardType: "unit",
          controller: "opponent",
          zone: HERE_ZONE,
        },
      },
    },
  ],
});

registerCardScript({
  name: "Svellsongur",
  text: "[Equip][1][Calm]  ([1][Calm]: Attach this to a unit you control.)\nAs this is attached to a unit, copy that unit's text to this Equipment's effect text for as long as this is attached to it.",
  status: "manual",
  notes: `"Copy that unit's text to this Equipment's effect text": copying text (446) is not implemented, and copied effect text would also need effect-text abilities of attached cards (718.3).`,
  abilities: [],
});

registerCardScript({
  name: "Forgefire Cape",
  text: "[Unique] (Your deck can only have 1 card with this name.)\n[Equip][Rune] ([Rune]: Attach this to a unit you control.)\n\nWhen I attack or defend, deal 2 to all enemy units here.\n+3 [Might]",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK_OR_DEFEND,
      effect: {
        op: "deal",
        amount: 2,
        target: { cardType: "unit", controller: "opponent", zone: HERE_ZONE },
      },
    },
    mightBonus(3),
  ],
});

registerCardScript({
  name: "Trinity Force",
  text: "[Equip][Body] ([Body]: Attach this to a unit you control.)\n\nWhen I hold, score 1 point. +2 [Might]",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_I_HOLD, effect: { op: "score_points", amount: 1 } },
    mightBonus(2),
  ],
});

registerCardScript({
  name: "Warmog's Armor",
  text: "[EQUIP] [Body] ([Body]: Attach this to a unit you control.)\n\nWhen I conquer, buff me. (If I don't have a buff, I get a +1 [Might] buff.)\n+1 [Might]",
  status: "implemented",
  abilities: [
    // 136.2.d: "me" in appended Effect Text is the Top-Most card (the equipped unit).
    { kind: "triggered", trigger: WHEN_I_CONQUER, effect: { op: "buff", target: SELF } },
    mightBonus(1),
  ],
});

registerCardScript({
  name: "World Atlas",
  text: "[EQUIP] [Mind] ([Mind]: Attach this to a unit you control.)\n\nWhen I hold, play two Gold Gear tokens exhausted.\n+2 [Might]",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_I_HOLD, effect: gold(2) },
    mightBonus(2),
  ],
});

registerCardScript({
  name: "Sacred Shears",
  text: "[Equip][Order] ([Order]: Attach this to a unit you control.)\n\n[DEATHKNELL] — Draw 1. (When I die, get the effect.)\n+1 [Might]",
  status: "implemented",
  abilities: [
    // Deathknell is printed Rules Text: inactive while attached (718.2), so it triggers only
    // when the unattached Equipment itself dies (a host's death detaches it, 719.5).
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      condition: custom("sfd:self-unattached"),
      effect: { op: "draw", amount: 1 },
    },
    mightBonus(1),
  ],
});

registerCardScript({
  name: "Last Rites",
  text: "[Equip] — [Chaos], Recycle 2 cards from your trash (Pay the cost: Attach this to a unit you control.)\n\nWhen I conquer or hold, you may play a unit from your trash. (you still pay its costs.)\n+2 [Might]",
  status: "partial",
  notes: `Its Equip cost "Recycle 2 cards from your trash" is not a payable cost (203.3), and "When I conquer or hold, you may play a unit from your trash" is not scripted (effect-driven play from the trash, 420.3).`,
  abilities: [mightBonus(2)],
});

registerCardScript({
  name: "Skyfall of Areion",
  text: "[Equip][1][Fury] ([1][Fury]: Attach this to a unit you control.)\n\nMy hold effects are also conquer effects, and vice versa.\n+2 [Might]",
  status: "partial",
  notes: `"My hold effects are also conquer effects, and vice versa": no engine support for re-classifying conquer/hold triggered abilities (383.4.c/383.4.d).`,
  abilities: [mightBonus(2)],
});

registerCardScript({
  name: "Experimental Hexplate",
  text: "[EQUIP][Mind] ([Mind]: Attach this to a unit you control.)\n\nI am a Mech.\n+1",
  status: "partial",
  notes: `"I am a Mech" (the equipped unit gains the Mech tag): no tag-granting modifier in the layers (479.2 / 718.3).`,
  abilities: [mightBonus(1)],
});

registerCardScript({
  name: "Brutalizer",
  text: "[Equip][Calm] ([Calm]: Attach this to a unit you control.)\n\nIf this was attached to me this turn, I have an additional 2 [Might] \n+1 [Might]",
  status: "partial",
  notes: `"If this was attached to me this turn, +2 Might": attachments made this turn are not tracked by the engine (435 / 718).`,
  abilities: [mightBonus(1)],
});

registerCardScript({
  name: "Rabadon's Deathcrown",
  text: "[Unique] (Your deck can have only 1 card with this name.)\n\n[Equip] [Power] ([Power]: Attach this to a unit you control.)\n\n\nYour spells and abilities deal 3 Bonus Damage (while this is attached). \n+3 Might",
  status: "implemented",
  abilities: [
    // 712–715 / 724: a player-level Effect Text passive, active only while attached.
    whilePassive(custom("sfd:self-attached"), {
      kind: "custom",
      id: "bonus-damage",
      params: { amount: 3 },
    }),
    mightBonus(3),
  ],
});

registerCardScript({
  name: "Shurelya's Requiem",
  text: "[Unique] (Your deck can have only 1 card with this name.)\n\n[Equip][Rune] ([Rune]: Attach this to a unit you control.) \nWhen you play this, ready your units.\n\n\nYour units here have [Ganking] (We can move from battlefield to battlefield.)\n+2 [Might]",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Ganking"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "ready", target: { cardType: "unit", controller: "self" } },
    },
    // 724: Effect Text passive for other units, active only while attached (718.3).
    whilePassive(custom("sfd:self-attached"), {
      kind: "keyword",
      keyword: "Ganking",
      target: { cardType: "unit", controller: "self", zone: HERE_ZONE },
    }),
    mightBonus(2),
  ],
});

registerCardScript({
  name: "Guardian Angel",
  text: "[Equip][Calm]  ([Calm]: Attach this to a unit you control.)\n\nIf I would die, kill Guardian Angel instead. Heal me, Exhaust me, and recall me.\n+1 [Might]",
  status: "implemented",
  abilities: [
    // 369.1 / 718.3: an attached card's Effect Text replacement is appended to the host. "I"
    // is the Top-Most card (136.2.d); "Guardian Angel" is the attached card itself.
    {
      kind: "replacement",
      matches: { type: "kill", subject: { targetRef: "host" } },
      replace: {
        op: "seq",
        effects: [
          { op: "kill", target: SELF },
          { op: "heal", amount: 99, target: EVENT_SUBJECT },
          { op: "exhaust", target: EVENT_SUBJECT },
          { op: "recall", target: EVENT_SUBJECT },
        ],
      },
    },
    mightBonus(1),
  ],
});

registerCardScript({
  name: "The Zero Drive",
  text: "[Equip][1][Mind] ([1][Mind]: Attach this to a unit you control.)\n[3][Mind], Banish this: Play all units banished with this, ignoring their costs. (Use only if unattached.)\n\n[Deathknell] — Banish me. (When I die, get the effect.)\n+2 [Might]",
  status: "partial",
  notes: `Deathknell "[Deathknell] — Banish me" is not scripted; "[3][Mind], Banish this: Play all units banished with this" needs cards banished with a specific object tracked and a payable "Banish this" cost (357.2).`,
  abilities: [...notIntrinsic("Deathknell"), mightBonus(2)],
});

registerCardScript({
  name: "Edge of Night",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nWhen you play this from face down, attach it to a unit you control (here).\n[Equip] [Chaos] ([Chaos]: Attach this to a unit you control.)\n\n+2 [Might].",
  status: "partial",
  notes: `"When you play this from face down, attach it": card-play events do not record the facedown origin (811.1.b, 420.4), so the trigger cannot be detected. Equip and +2 Might are implemented.`,
  abilities: [mightBonus(2)],
});

/* ---------------------------------------------------------------- Mech lords and passives */

registerCardScript({
  name: "Petricite Monument",
  text: "[Temporary] (Kill this at the start of its controller's Beginning Phase, before scoring.)\nFriendly units have [Deflect]. (Opponents must pay [Rune] to choose them with a spell or ability.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Deflect"),
    {
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Deflect",
        target: { cardType: "unit", controller: "self" },
      },
    },
  ],
});

registerCardScript({
  name: "Breakneck Mech",
  text: "Your Mechs have [Deflect] and [Ganking]. (Opponents must pay [Rune] to choose us with a spell or ability. We can move from battlefield to battlefield.)\nI enter ready if you control another Mech.",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Deflect"),
    ...notIntrinsic("Ganking"),
    { kind: "passive", modifier: { kind: "keyword", keyword: "Deflect", target: MECHS } },
    { kind: "passive", modifier: { kind: "keyword", keyword: "Ganking", target: MECHS } },
    enterReady({ kind: "exists", selector: { ...MECHS, excludeSource: true } }),
  ],
});

registerCardScript({
  name: "Forecaster",
  text: "Your Mechs have [Vision]. (When you play us, look at the top card of your Main Deck. You may recycle it.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Vision"),
    { kind: "passive", modifier: { kind: "keyword", keyword: "Vision", target: MECHS } },
  ],
});

registerCardScript({
  name: "Rumble, Mechanized Menace",
  text: "Your Mechs have [SHIELD]. (+1 [Might] while they're defenders.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Shield"),
    { kind: "passive", modifier: { kind: "keyword", keyword: "Shield", target: MECHS } },
  ],
});

registerCardScript({
  name: "Rumble, Scrapper",
  text: "Your Mechs have +1 [Might] (including me).\nWhen I hold, play a 3 [Might] Mech unit token to your base.",
  status: "implemented",
  abilities: [
    { kind: "passive", modifier: { kind: "might", amount: 1, target: MECHS } },
    { kind: "triggered", trigger: WHEN_I_HOLD, effect: mech() },
  ],
});

registerCardScript({
  name: "Trusty Ramhound",
  text: "While you have another unit here, I have +1 [Might].",
  status: "implemented",
  abilities: [
    whilePassive(
      {
        kind: "exists",
        selector: { cardType: "unit", controller: "self", zone: HERE_ZONE, excludeSource: true },
      },
      { kind: "might", amount: 1, target: SELF },
    ),
  ],
});

registerCardScript({
  name: "Ornn, Forge God",
  text: "[Deflect 2] (Opponents must pay [Rune][Rune] to choose me with a spell or ability.)\n[Weaponmaster] (When you play me, you may [Equip] one of your Equipment to me for [Rune] less, even if it's already attached.)\nI have +1 [Might] for each friendly gear.",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "might",
        amount: countOf({ cardType: "gear", controller: "self" }),
        target: SELF,
      },
    },
  ],
});

registerCardScript({
  name: "Battering Ram",
  text: "I cost [1] less for each card you've played this turn, to a minimum of [1].",
  status: "implemented",
  // 356.4.e: the minimum applies only to this discount — at most [4] off its [5] (356.4.g).
  abilities: stepDiscounts((k) => custom("cards-played", { op: "gte", value: k }), 1, 4),
});

registerCardScript({
  name: "Jaull-Fish",
  text: "[ACCELERATE] (You may pay [1] [Body] as an additional cost to have me enter ready.)\nI cost [2] less for each of your [MIGHTY] units. (A unit is Mighty while it has 5+ [Might].)",
  status: "implemented",
  // Four steps of [2] already exceed its [7] (the total cost is floored at 0, 356).
  abilities: stepDiscounts(
    (k) => ({
      kind: "count",
      selector: { cardType: "unit", controller: "self", mighty: true },
      comparison: { op: "gte", value: k },
    }),
    2,
    4,
  ),
});

/* ---------------------------------------------------------------- gear with activated abilities */

registerCardScript({
  name: "Heart of Dark Ice",
  text: "[Tap]: Give a unit +3 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: { op: "temporary_might", amount: 3, target: target() },
    },
  ],
});

registerCardScript({
  name: "Poro Snax",
  text: "When you play this, draw 1.\n[1][Calm], [Tap], Kill this: Draw 1.",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "draw", amount: 1 } },
    {
      kind: "activated",
      cost: { energy: 1, power: { Calm: 1 }, exhaust: SELF, kill: SELF },
      effect: { op: "draw", amount: 1 },
    },
  ],
});

/* ---------------------------------------------------------------- Repeat spells */

const DEAL_ONE_SAME_LOCATION: Effect = {
  op: "seq",
  effects: [
    { op: "deal", amount: 1, target: target({ maxCount: 1, targetRef: "target:0" }) },
    {
      op: "deal",
      amount: 1,
      target: target({
        maxCount: 2,
        targetRef: "target:1",
        sameLocationAs: "target:0",
        excludeRefs: ["target:0"],
      }),
    },
  ],
};

registerCardScript({
  name: "Bellows Breath",
  text: "[Action] (Play on your turn or in showdowns.)\n[Repeat][1][Mind] (You may pay the additional cost to repeat this spell's effect.)\nDeal 1 to up to three units at the same location.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: DEAL_ONE_SAME_LOCATION }],
});

registerCardScript({
  name: "Blood Rush",
  text: "[Action] (Play on your turn or in showdowns.)\n[Repeat] [1] (You may pay the additional cost to repeat this spell's effect.)\nGive a unit [Assault 2] this turn. (+2 [Might] while it's an attacker.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Assault"),
    {
      kind: "spell",
      effect: {
        op: "grant_keyword",
        keyword: "Assault", value: 2,
        target: target(),
        duration: "this-turn",
      },
    },
  ],
});

registerCardScript({
  name: "Danger Zone",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\n[Repeat] [1] [Rune] (You may pay the additional cost to repeat this spell's effect.)\nGive your Mechs +1 [Might] this turn.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "temporary_might", amount: 1, target: MECHS } }],
});

registerCardScript({
  name: "Desert's Call",
  text: "[Repeat][2] (You may pay the additional cost to repeat this spell's effect.)\nPlay a 2 [Might] Sand Soldier unit token.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: sandSoldier() }],
});

registerCardScript({
  name: "Called Shot",
  text: "[ACTION] (Play on your turn or in showdowns.)\n[REPEAT] [CHAOS] (You may pay the additional cost to repeat this spell's effect.)\nLook at the top 2 cards of your Main Deck. Draw one and recycle the other.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "look",
        amount: 2,
        then: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "drawn",
              selector: { zone: "deck", where: custom("in-ref", { ref: "looked" }) },
              min: 1,
              max: 1,
            },
            { op: "custom", id: "sfd:draw-ref", params: { ref: "drawn" } },
            {
              op: "recycle",
              target: {
                zone: "deck",
                where: {
                  kind: "and",
                  conditions: [
                    custom("in-ref", { ref: "looked" }),
                    { kind: "not", condition: custom("in-ref", { ref: "drawn" }) },
                  ],
                },
              },
            },
          ],
        },
      },
    },
  ],
});

registerCardScript({
  name: "Bonds of Strength",
  text: "[REACTION] (Play any time, even before spells and abilities resolve.)\n[REPEAT][2] (You may pay the additional cost to repeat this spell's effect.)\nGive two friendly units each +1 [Might]",
  status: "manual",
  notes:
    'The catalog text omits the duration of "+1 [Might]" (no "this turn", no closing period), so the effect cannot be scripted faithfully; it resolves in the §6.4 manual window until the text is confirmed. Repeat (820.1.d) is also not executed by the engine.',
  abilities: [],
});
