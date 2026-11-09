/**
 * Radiance (RAD) units scripted/upgraded in wave R4.
 *
 * Upgrade: Incorrigible Construct (Show Off 832 now lands). New: Akali, Brash; Bloodscent
 * Swarm; Dune Devourer; Ekko, Ingenious; Entrenched Boar; Firebrand Raider; Gutter Guardian;
 * Herald of the Emperor; K'Sante, Pride of Nazumah; Kai'Sa, Rebel; Lingering Animus; Lulu,
 * Whimsical; Meticulous Restorationist; Mordekaiser, Iron Revenant; Mordekaiser, Twice Slain;
 * Neeko, Blending In; Orianna, Lady of Clockwork; Orianna, Mechanical Marvel; Piltovan
 * Guidebot; Seraphine, Inspiring; Seraphine, Starry-Eyed Songstress; Skystrike Squadron;
 * Spirit of the Forge; The Empyrean.
 */
import type { Cost } from "@rift/protocol";
import { registerCardScript } from "../registry";
import { registerAdditionalCosts } from "../../play/additional-costs";
import {
  SELF,
  SELF_AT_BATTLEFIELD,
  SHOWED_OFF,
  WHEN_I_MOVE,
  WHEN_PLAYED,
  aUnit,
  custom,
  not,
  showOff,
} from "../dsl";
import { letX, notIntrinsic, conditional } from "./dsl";

const SELF_EMPOWERED = custom("self-empowered");
const DEFLECT_GAP =
  "The optional additional cost (356.2.b.1) cannot be paid: the protocol Cost has no 'return a gear to hand' part, so only the base play and the printed keyword are automated.";

/** 827.1.c.1: "[Empower] [Cost]" — "[Cost]: Empower this. Use only if not Empowered." */
function empower(cost: Cost) {
  return {
    kind: "activated" as const,
    cost,
    effect: {
      op: "requires" as const,
      condition: not(SELF_EMPOWERED),
      rule: "827.1.c.1",
      effect: { op: "empower" as const, target: SELF },
    },
  };
}

/* ---------------------------------------------------------------- movement / costs */

/** Akali, Brash (RAD-015) — first move Adds [1][Rune]; second banishes the top card and may play it. */
registerCardScript({
  name: "Akali, Brash",
  text: "The first time I move each turn, [Add] [1] [Rune].\nThe second time I move each turn, banish the top card of your Main Deck. Until your next Ending Phase, you may play that card. (You still pay its costs.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Add"),
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "move", subject: SELF, condition: custom("rad:move-count-lt", { n: 2 }) },
      },
      effect: { op: "custom", id: "rad:akali-move" },
    },
  ],
});

/** Bloodscent Swarm (RAD-080) — "I cost [2] less for each battlefield you've conquered this turn." */
registerCardScript({
  name: "Bloodscent Swarm",
  text: "I cost [2] less for each battlefield you've conquered this turn.",
  status: "partial",
  notes:
    "No per-turn record of conquered battlefields exists (356.4; the history only counts cards played and scored battlefields), so the discount is not automated.",
  abilities: [],
});

/**
 * Dune Devourer (RAD-125) — "You may kill a friendly unit as an additional cost to play me. If
 * you do, I cost [2] less. [Deflect]" The optional kill cost is registered; reading the paid
 * unit to reduce the cost is not expressible (356.2.b.1, 357.2).
 */
registerAdditionalCosts("Dune Devourer", [
  {
    id: "optional:0",
    optional: true,
    cost: { kill: { cardType: "unit", controller: "self" } },
    rule: "356.2.b.1",
    label: "Kill a friendly unit",
  },
]);
registerCardScript({
  name: "Dune Devourer",
  text: "You may kill a friendly unit as an additional cost to play me. If you do, I cost [2] less.\n[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)",
  status: "partial",
  notes:
    "The optional kill cost and [Deflect] are automated; the [2] discount for paying it is not (the cost layer cannot read an object paid as a cost, 356.2.b.1, 357.2).",
  abilities: [],
});

/**
 * Entrenched Boar (RAD-026) — "You may have me enter ready. If you do, I can't move this turn."
 * The choice is an optional zero-cost additional cost (355.1.a); the linked entry replacement
 * and move restriction read the paid-additional flag (369.3, 054.1).
 */
registerAdditionalCosts("Entrenched Boar", [
  {
    id: "optional:0",
    optional: true,
    cost: {},
    rule: "369.3",
    label: "Have me enter ready",
  },
]);
registerCardScript({
  name: "Entrenched Boar",
  text: "You may have me enter ready. If you do, I can't move this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: conditional(custom("rad:paid-additional-self"), {
        kind: "custom",
        id: "enter-ready",
        params: { target: SELF },
      }),
    },
    {
      kind: "passive",
      modifier: conditional(custom("rad:paid-additional-self"), {
        kind: "restriction",
        restriction: "move",
        target: SELF,
      }),
    },
  ],
});

/**
 * Ekko, Ingenious (RAD-061) — mandatory "return a friendly unit to its owner's hand" additional
 * cost; the Cost shape has no return-to-hand part, so the card stays in the manual window.
 */
registerCardScript({
  name: "Ekko, Ingenious",
  text: "As an additional cost to play me, return a friendly unit to its owner's hand.\n[Ganking] (I can move from battlefield to battlefield.)",
  status: "manual",
  notes:
    "The mandatory additional cost 'return a friendly unit to its owner's hand' is not a payable Cost part (357.2); [Ganking] is the printed keyword.",
  abilities: [],
});

/** Firebrand Raider (RAD-019) — entry/ready hooks; the global lines need entry-for-all and an Awaken skip. */
registerCardScript({
  name: "Firebrand Raider",
  text: "I enter ready.\nWhen you play me, ready all enemy units.\nOther units enter ready.\nUnits don't ready during the Awaken Phase.",
  status: "partial",
  notes:
    "I enter ready and 'When you play me, ready all enemy units' are automated. 'Other units enter ready' cannot apply across controllers (the entry layer filters by the modifier's controller, 369.3) and 'Units don't ready during the Awaken Phase' needs a global ready skip (315.1, 444).",
  abilities: [
    { kind: "passive", modifier: { kind: "custom", id: "enter-ready", params: { target: SELF } } },
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "ready", target: { cardType: "unit", controller: "opponent" } },
    },
  ],
});

/* ---------------------------------------------------------------- Show Off / keywords */

/** Gutter Guardian (RAD-103) — [Hidden]; [Show Off] a card with [Hidden]; Add [Rune] if you did. */
registerCardScript({
  name: "Gutter Guardian",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\n[Show Off] a card with [Hidden]. (As you play me, you may reveal such a card from your hand or pick another friendly one on the board.)\nWhen you play me, if you showed off, [Add] [Rune].",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Add"),
    showOff({ keyword: "Hidden" }),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: SHOWED_OFF,
      effect: { op: "add", resources: { power: { any: 1 } } },
    },
  ],
});

/** Incorrigible Construct (RAD-011) — [Show Off] a Mech; enters ready if you showed off (832, 369.3). */
registerCardScript({
  name: "Incorrigible Construct",
  text: "[Show Off] a Mech. (As you play me, you may reveal a Mech from your hand or pick another friendly Mech.)\nI enter ready if you showed off.",
  status: "implemented",
  abilities: [
    showOff({ tag: "Mech" }),
    {
      kind: "passive",
      modifier: conditional(SHOWED_OFF, { kind: "custom", id: "enter-ready", params: { target: SELF } }),
    },
  ],
});

/** Kai'Sa, Rebel (RAD-063) — [Disarm]; while in a showdown, your spells have [Reaction]. */
registerCardScript({
  name: "Kai'Sa, Rebel",
  text: "[Disarm] (When I attack, give an enemy unit here -1[Might] this turn.)\nWhile I'm in a showdown, your spells have [Reaction]. (Play them any time, even before spells and abilities resolve.)",
  status: "partial",
  notes:
    '"Your spells have [Reaction]" is a passive keyword grant to cards in hand; the play layer\'s keyword array form does not see passives (801.3, 806).',
  abilities: [
    ...notIntrinsic("Reaction"),
    {
      kind: "passive",
      modifier: conditional(
        {
          kind: "or",
          conditions: [
            { kind: "is-state", state: "showdown_open" },
            { kind: "is-state", state: "showdown_closed" },
          ],
        },
        { kind: "keyword", keyword: "Reaction", target: { cardType: "spell", controller: "self" } },
      ),
    },
  ],
});

/* ---------------------------------------------------------------- base-Might changes */

/** Herald of the Emperor (RAD-118) — choose a friendly unit; its base Might becomes 5 this turn. */
registerCardScript({
  name: "Herald of the Emperor",
  text: "When you play me, choose a friendly unit. Its base Might becomes 5 this turn.",
  status: "partial",
  notes:
    'Modelled as a this-turn Might change of (5 − base Might); trait-altering "base Might becomes" is not a layer (479).',
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "for_each",
        selector: aUnit({ controller: "self", targetRef: "target:0" }),
        effect: { op: "custom", id: "rad:base-might-becomes", params: { value: 5 } },
      },
    },
  ],
});

/** Lulu, Whimsical (RAD-110) — when I move, may have another unit's base Might become 4 this turn. */
registerCardScript({
  name: "Lulu, Whimsical",
  text: "When I move, you may have another unit's base Might become 4 this turn.",
  status: "partial",
  notes:
    'Modelled as a this-turn Might change of (4 − base Might); trait-altering "base Might becomes" is not a layer (479).',
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      effect: {
        op: "may",
        effect: {
          op: "for_each",
          selector: aUnit({ excludeSource: true, targetRef: "target:0" }),
          effect: { op: "custom", id: "rad:base-might-becomes", params: { value: 4 } },
        },
      },
    },
  ],
});

/** Piltovan Guidebot (RAD-057) — when you play a card, may set my base Might to its Energy cost. */
registerCardScript({
  name: "Piltovan Guidebot",
  text: "When you play a card, you may have my base Might become equal to that card's Energy cost this turn.",
  status: "partial",
  notes:
    'Modelled as a this-turn Might change of (Energy cost − base Might); trait-altering "base Might becomes" is not a layer (479).',
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "played", player: "self" } },
      effect: {
        op: "may",
        effect: {
          op: "custom",
          id: "rad:base-might-becomes",
          params: { selector: SELF, energyCostOf: { targetRef: "event" } },
        },
      },
    },
  ],
});

/* ---------------------------------------------------------------- activated abilities */

/** K'Sante, Pride of Nazumah (RAD-147, legend) — [1], [Tap]: give a unit [Assault] equal to its [Shield]. */
registerCardScript({
  name: "K'Sante, Pride of Nazumah",
  text: "[1], [Tap]: Give a friendly unit \"I have [Assault] equal to my [Shield]\" this turn. (+1 [Might] for each instance of Assault while it's an attacker.)",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: {
        op: "for_each",
        selector: aUnit({ controller: "self", targetRef: "target:0" }),
        effect: letX(
          { keywordValue: "Shield", of: { targetRef: "it" } },
          {
            op: "grant_keyword",
            keyword: "Assault {X}",
            target: { targetRef: "it" },
            duration: "this-turn",
          },
        ),
      },
    },
    ...notIntrinsic("Assault", "Shield"),
  ],
});

/**
 * Orianna, Mechanical Marvel (RAD-068) — once each turn while at a battlefield, the next gear
 * costs [1][Rune] less. Modelled as a once-per-turn cost-adjust (420.5); consumption happens on
 * the next card played of any type and the "may" is automatic.
 */
registerCardScript({
  name: "Orianna, Mechanical Marvel",
  text: "Once each turn, while I'm at a battlefield, you may pay [1] [Rune] less to play a gear.",
  status: "partial",
  notes:
    "The [1][Rune] discount is a once-per-turn cost-adjust; it is consumed by the next card played even when that card is not a gear, and the optional 'may' is automatic (420.5, 356.4).",
  abilities: [
    {
      kind: "passive",
      modifier: conditional(SELF_AT_BATTLEFIELD, {
        kind: "custom",
        id: "cost-adjust",
        params: {
          energy: -1,
          power: { any: -1 },
          target: { cardType: "gear", controller: "self" },
          once: true,
        },
      }),
    },
  ],
});

/**
 * Mordekaiser, Iron Revenant (RAD-143, legend) — [Reaction] Banish a unit or gear from your
 * trash, [Tap]: [Add][Rune]. The banish is modelled as a chosen instruction (a cost cannot name
 * a trash card, 357.2) and the Power-spending restriction is not modelled (430.5).
 */
registerCardScript({
  name: "Mordekaiser, Iron Revenant",
  text: "[Reaction] Banish a unit or gear from your trash, [Tap]: [Add][Rune]. Spend this Power only to play units or gear. (Abilities that add resources can't be reacted to.)",
  status: "partial",
  notes:
    "The banish is a resolution instruction (not a cost) and 'Spend this Power only to play units or gear' is not modelled: ResourceSpec has no spending restriction (357.2, 430.5).",
  abilities: [
    ...notIntrinsic("Add"),
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["reaction"],
      addsResources: true,
      effect: {
        op: "requires",
        condition: {
          kind: "exists",
          selector: { zone: "trash", controller: "self", where: custom("rad:unit-or-gear") },
        },
        rule: "377.2.b",
        effect: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "banished",
              selector: { zone: "trash", controller: "self", where: custom("rad:unit-or-gear") },
            },
            { op: "banish", target: { targetRef: "banished" } },
            { op: "add", resources: { power: { any: 1 } } },
          ],
        },
      },
    },
  ],
});

/** Ekko, Boy Who Shattered Time (RAD-139/168, legend) — Empower; disempower to discount the next unit. */
registerCardScript({
  name: "Ekko, Boy Who Shattered Time",
  text: "[Empower] — [1], [Tap] (Use only if not Empowered.)\nDisempower me, [Tap]: Reduce the cost of the next unit you play this turn by [2] [Rune] and give it \"Kill me at end of turn.\"",
  status: "partial",
  notes:
    "Empower and the [2][Rune] next-unit discount are automated; 'disempower me' is modelled as a precondition paid on resolution (357.2 has no disempower Cost part), the discount is consumed by the next card of any type, and the granted kill-at-end trigger attaches to the next unit (not necessarily the discounted one).",
  abilities: [
    empower({ energy: 1 }),
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: {
        op: "requires",
        condition: SELF_EMPOWERED,
        rule: "357.2",
        effect: {
          op: "seq",
          effects: [
            { op: "disempower", target: SELF },
            {
              op: "continuous",
              duration: "this-turn",
              modifier: {
                kind: "custom",
                id: "cost-adjust",
                params: {
                  energy: -2,
                  power: { any: -1 },
                  target: { cardType: "unit", controller: "self" },
                  once: true,
                },
              },
            },
            {
              op: "delayed",
              trigger: { kind: "event", event: { type: "unit_played", player: "self" } },
              duration: "this-turn",
              once: true,
              effect: { op: "custom", id: "rad:delayed-kill-event" },
            },
          ],
        },
      },
    },
  ],
});

/* ---------------------------------------------------------------- replacements */

/**
 * Mordekaiser, Twice Slain (RAD-020) — "Once each turn, if I would die, you may kill a friendly
 * unit to heal me, exhaust me, and recall me instead." (367–375, 371.2 optional replacement.)
 */
registerCardScript({
  name: "Mordekaiser, Twice Slain",
  text: "[Accelerate] (You may pay [1] [Fury] as an additional cost to have me enter ready.)\n[Assault 3] (+3 [Might] while I'm an attacker.)\nOnce each turn, if I would die, you may kill a friendly unit to heal me, exhaust me, and recall me instead.",
  status: "implemented",
  abilities: [
    {
      kind: "replacement",
      matches: { type: "kill", subject: SELF },
      limit: { kind: "once-per-turn" },
      replace: {
        op: "cost_then",
        optional: true,
        cost: { kill: { cardType: "unit", controller: "self", excludeSource: true } },
        effect: {
          op: "seq",
          effects: [
            {
              op: "heal",
              amount: { kind: "damage", selector: { targetRef: "event" } },
              target: { targetRef: "event" },
            },
            { op: "exhaust", target: { targetRef: "event" } },
            { op: "recall", target: { targetRef: "event" } },
          ],
        },
      },
    },
  ],
});

/**
 * Seraphic Wyvern (RAD-092) — "If you would channel runes, channel that many runes plus 1
 * exhausted rune instead." (367–375 replacement of the Channel action, 431.)
 */
registerCardScript({
  name: "Seraphic Wyvern",
  text: "If you would channel runes, channel that many runes plus 1 exhausted rune instead.",
  status: "partial",
  notes:
    "The replacement channels the proposed count plus one exhausted rune, but the Channel proposal does not carry the original 'exhausted' condition: a channel that itself said 'exhausted' would channel its base runes ready (431.2).",
  abilities: [
    {
      kind: "replacement",
      matches: { type: "channel", player: "self" },
      replace: { op: "custom", id: "rad:channel-plus-one" },
    },
  ],
});

/* ---------------------------------------------------------------- unautomated / manual */

/** Lingering Animus (RAD-005) — "I enter ready if a friendly unit or gear died this turn." */
registerCardScript({
  name: "Lingering Animus",
  text: "I enter ready if a friendly unit or gear died this turn.",
  status: "manual",
  notes:
    "No per-turn record of units/gear that died exists (383.2.c, 369.3), so the conditional entry replacement cannot be evaluated.",
  abilities: [],
});

/** Meticulous Restorationist (RAD-120) — triggered ability of a card in the trash (385). */
registerCardScript({
  name: "Meticulous Restorationist",
  text: "When you play a card with Energy cost [7] or more, you may play me from your trash for [Order].",
  status: "manual",
  notes:
    "Triggered abilities of cards in the trash are not detected (385) and the [Order] play-from-trash permission is part of that trigger.",
  abilities: [],
});

/** Neeko, Blending In (RAD-167, errata) — deck-building extra legends; not modelled. */
registerCardScript({
  name: "Neeko, Blending In",
  text: "(Neutral cards can go in decks of any Domain.)\nIf Neeko is in your deck, choose up to 3 different legends in addition to your starting legend. (Different means none match names.)\nWhen you play me, choose one of those Legends and add it to your Legend Zone while I'm on the board.",
  status: "manual",
  notes:
    "The card needs deck-building selections (up to 3 extra legends) and adding a chosen legend to the Legend Zone while Neeko is on the board; neither is stored by the engine.",
  abilities: [],
});

/** Orianna, Lady of Clockwork (RAD-145/171, legend) — gear becomes a unit gear (trait-altering, 479–481). */
registerCardScript({
  name: "Orianna, Lady of Clockwork",
  text: "At the start of your Main Phase, you may pay [1] to choose a friendly gear. It becomes a unit gear with Might equal to its Energy cost until you choose another gear with me.",
  status: "manual",
  notes:
    "Needs trait-altering 'becomes a unit gear' (card type change) and a last-chosen link between the two abilities; layers only do numeric Might/keyword changes (479–481).",
  abilities: [],
});

/** Seraphine, Inspiring (RAD-065) — exhaust three or more friendly units at the same time. */
registerCardScript({
  name: "Seraphine, Inspiring",
  text: "[Disarm 2] (When I attack, give an enemy unit here -2 [Might] this turn.)\nOnce each turn, when you exhaust three or more friendly units at the same time, you may draw 1.",
  status: "manual",
  notes:
    "Individual exhaust actions emit one event each; there is no grouping of simultaneous exhausts or count of 'three or more at the same time' (383.1, 415), so the trigger cannot be detected faithfully.",
  abilities: [],
});

/** Seraphine, Starry-Eyed Songstress (RAD-151/174, legend) — four-object optional additional cost. */
registerCardScript({
  name: "Seraphine, Starry-Eyed Songstress",
  text: "As an additional cost to play a spell, you may exhaust me and three friendly units to reduce the cost of that spell by [2].",
  status: "manual",
  notes:
    "An optional additional cost that exhausts the legend plus three units cannot be expressed (Cost.exhaust is one selector, and component discounts on optional costs are not modelled; 356.2.b.1, 356.4.c, 357.2).",
  abilities: [],
});

/** Skystrike Squadron (RAD-075) — optional "return a gear" additional cost and its [2] discount. */
registerCardScript({
  name: "Skystrike Squadron",
  text: "You may return a friendly gear to its owner's hand as an additional cost to play me. If you do, I cost [2] less.\n[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)",
  status: "partial",
  notes: DEFLECT_GAP,
  abilities: [],
});

/** Spirit of the Forge (RAD-066) — optional "return a gear" additional cost and its payoff. */
registerCardScript({
  name: "Spirit of the Forge",
  text: "You may return a friendly gear to its owner's hand as an additional cost to play me.\nWhen you play me, if you paid the additional cost, ready me and give me +[Might] this turn equal to the Energy cost of the gear you returned.",
  status: "partial",
  notes: DEFLECT_GAP,
  abilities: [],
});

/** The Empyrean (RAD-060) — [Show Off] a card; if you did, Predict its Power cost, then draw 2. */
registerCardScript({
  name: "The Empyrean",
  text: "[Show Off] a card. (As you play me, you may reveal a card from your hand or pick another friendly one.)\nWhen you play me, if you showed off a card, [Predict] equal to its Power cost, then draw 2. (Look at that many cards from your Main Deck. Recycle any of them and put the rest back in any order.)",
  status: "implemented",
  abilities: [
    showOff({}),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: SHOWED_OFF,
      effect: {
        op: "seq",
        effects: [
          { op: "predict", amount: { kind: "shown-off", property: "power-cost" } },
          { op: "draw", amount: 2 },
        ],
      },
    },
  ],
});
