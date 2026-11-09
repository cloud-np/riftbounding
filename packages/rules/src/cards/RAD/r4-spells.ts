/**
 * Radiance (RAD) spells scripted/upgraded in wave R4.
 *
 * Upgrade (R3-engine): Scorched Earth uses damage split (355.14 / 715.3). New: Chronobreak,
 * Encore, Fanfare, Last Caress, Parallel Convergence, Primordial Roar, Remember the Fallen.
 */
import { registerCardScript } from "../registry";
import { SHOWED_OFF, aUnit, custom, showOff, token } from "../dsl";
import { drawCard, letX } from "./dsl";

const LOOKED = custom("in-ref", { ref: "looked" });

const ENCORE_MODES = [
  {
    id: "deal",
    label: "Deal 2 to a unit",
    effect: { op: "deal" as const, amount: 2, target: aUnit() },
  },
  {
    id: "tokens",
    label: "Play two 1 Might Recruit unit tokens",
    effect: {
      op: "create" as const,
      token: token("Recruit", { count: 2, might: 1, play: true }),
      zone: "base" as const,
    },
  },
  {
    id: "might",
    label: "Give up to two units each +1 Might this turn",
    effect: { op: "temporary_might" as const, amount: 1, target: aUnit({ maxCount: 2 }) },
  },
  {
    id: "look",
    label: "Look at the top 2, draw 1 and recycle the other",
    effect: {
      op: "look" as const,
      amount: 2,
      then: {
        op: "seq" as const,
        effects: [
          {
            op: "choose" as const,
            key: "drawn",
            selector: { zone: "deck" as const, controller: "self" as const, where: LOOKED },
            min: 0,
            max: 1,
          },
          drawCard("drawn"),
          {
            op: "recycle" as const,
            target: {
              zone: "deck" as const,
              controller: "self" as const,
              where: LOOKED,
              excludeRefs: ["drawn"],
            },
          },
        ],
      },
    },
  },
];

/** Scorched Earth (RAD-006) — "Deal 5 damage split among units at a single battlefield." (355.14) */
registerCardScript({
  name: "Scorched Earth",
  text: "[Action] (Play on your turn or in showdowns.)\nDeal 5 damage split among units at a single battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "deal_split",
        amount: 5,
        target: {
          chosen: true,
          cardType: "unit",
          zone: "battlefield",
          group: { sameLocation: true },
        },
      },
    },
  ],
});

/** Primordial Roar (RAD-082) — [Show Off] a unit; deal its Might to a unit. (832) */
registerCardScript({
  name: "Primordial Roar",
  text: "[Show Off] a unit. (As you play this, you may reveal a unit from your hand or pick a friendly unit.)\nIf you showed off a unit, deal damage equal to that unit's Might to a unit.",
  status: "implemented",
  abilities: [
    showOff({ cardType: "unit" }),
    {
      kind: "spell",
      effect: {
        op: "if",
        condition: SHOWED_OFF,
        then: {
          op: "deal",
          amount: { kind: "shown-off", property: "might" },
          target: aUnit(),
        },
      },
    },
  ],
});

/**
 * Remember the Fallen (RAD-135) — "Play up to 3 units and/or gear from your trash, each with
 * Energy cost no more than [3] and Power cost no more than [Rune], ignoring their costs."
 */
registerCardScript({
  name: "Remember the Fallen",
  text: "Play up to 3 units and/or gear from your trash, each with Energy cost no more than [3] and Power cost no more than [Rune], ignoring their costs.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "cards",
            selector: {
              zone: "trash",
              controller: "self",
              where: custom("rad:unit-or-gear"),
              energyCost: { op: "lte", value: 3 },
              powerCost: { op: "lte", value: 1 },
            },
            min: 0,
            max: 3,
          },
          {
            op: "for_each",
            selector: { targetRef: "cards" },
            effect: { op: "play", target: { targetRef: "it" }, cost: "ignored" },
          },
        ],
      },
    },
  ],
});

/** Fanfare (RAD-047) — "The next three times you play a unit this turn, draw 1." (390–393) */
registerCardScript({
  name: "Fanfare",
  text: "The next three times you play a unit this turn, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "delayed",
        trigger: {
          kind: "event",
          event: {
            type: "unit_played",
            player: "self",
            condition: custom("rad:fanfare-pending"),
          },
        },
        duration: "this-turn",
        once: false,
        effect: { op: "custom", id: "rad:fanfare-draw" },
      },
    },
  ],
});

/** Encore (RAD-152) — "Choose two —" of four modes. See the status note for the timing deviation. */
registerCardScript({
  name: "Encore",
  text: "Choose two —\n • Deal 2 to a unit.\n • Play two 1 [might] Recruit unit tokens.\n • Give up to two units each +1 [might] this turn.\n • Look at the top 2 cards of your Main Deck, draw 1 and recycle the other.",
  status: "partial",
  notes:
    "All four modes are automated, but the two modes (and any targets) are chosen on resolution instead of when the spell is played: the engine's `choose_mode` play-time choice asks exactly one mode (355.3, 355.8).",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "custom",
        id: "rad:choose-modes",
        params: { modes: ENCORE_MODES, min: 2, max: 2, rule: "355.3", promptKey: "rules.prompt.chooseModes" },
      },
    },
  ],
});

/**
 * Last Caress (RAD-154, errata) — "[Reaction] The next unit you play this turn, even from face
 * down, can be played to any battlefield. When you play it, [Buff] it." (355.2.b, 420.1.a)
 */
registerCardScript({
  name: "Last Caress",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nThe next unit you play this turn, even from face down, can be played to any battlefield. When you play it, [Buff] it. (Give it a +1 [Might] buff if it doesn't have one.)",
  status: "partial",
  notes:
    'The delayed [Buff] for the next unit is automated. "Can be played to any battlefield" is a play-location permission; the play layer only accepts extra locations from effect-driven plays (355.2.b), so a normal next-unit play cannot use it.',
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "delayed",
        trigger: { kind: "event", event: { type: "unit_played", player: "self" } },
        duration: "this-turn",
        once: true,
        effect: { op: "buff", target: { targetRef: "event" } },
      },
    },
  ],
});

/**
 * Chronobreak (RAD-140) — pay any amount of Power, banish that many units, then their owners
 * replay them to the same location or their base. Needs an any-amount cost and location choice.
 */
registerCardScript({
  name: "Chronobreak",
  text: "As an additional cost to play this, pay any amount of Power.\nBanish that many units you control, then for each, its owner plays that unit back to the same location or to their base, ignoring its cost. (You choose the order.)",
  status: "manual",
  notes:
    "Needs an any-amount Power additional cost (203.3, 356.2) and effect-driven play to a chosen location (355.2 / 420.3.b); neither is expressible.",
  abilities: [],
});

/**
 * Parallel Convergence (RAD-051) — mandatory "return a friendly unit to its owner's hand"
 * additional cost, then deal 5 to a unit at a battlefield.
 */
registerCardScript({
  name: "Parallel Convergence",
  text: "As an additional cost to play this, return a friendly unit to its owner's hand.\nDeal 5 to a unit at a battlefield.",
  status: "manual",
  notes:
    "The mandatory additional cost 'return a friendly unit to its owner's hand' is not a payable Cost part (357.2), so the card cannot be played strictly; the damage instruction is simple but unreachable.",
  abilities: [],
});
