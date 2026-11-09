/**
 * Vendetta batch 4b: cards needing a few lane-specific conditions, Flow spells with a Burn, and
 * Empower/Disempower gear and legends.
 */
import { registerCardScript } from "../registry";
import { HERE, SELF, WHEN_PLAYED, aUnit, custom, not, token } from "../dsl";
import { registerCustomCondition, refIds } from "../../effects/evaluate";
import { RESOLVED } from "../../effects/execute";
import { registerCustomEffect } from "../../effects/ops/control";
import { evalContextOf, recordOutcome } from "../../effects/targets";
import { FLOW_GAP, SELF_EMPOWERED, WHEN_I_CONQUER, conditional, empower } from "./shared";

/* ---------------------------------------------------------------- custom conditions */

/** The source has not been dealt damage this turn (`damagedThisTurn`, cleared at turn start). */
registerCustomCondition("ven:self-not-damaged-this-turn", (ctx) => {
  const id = ctx.env.sourceObjectId;
  return !!id && !ctx.room.rules?.objects[id]?.damagedThisTurn;
});

/** The candidate (`it`) has the catalog tag `tag` (143.1). */
registerCustomCondition("ven:has-tag", (ctx, params) => {
  const id = ctx.env.it;
  const tag = typeof params.tag === "string" ? params.tag.toLowerCase() : "";
  if (!id || !tag) return false;
  const card = ctx.host.findCard(ctx.room, id)?.card;
  return (card?.subtypes ?? []).some((entry) => entry.toLowerCase() === tag);
});

/**
 * "Put the rest into your trash" after a `look`: the looked-at cards (`looked`) except those
 * bound to `params.keep` go from the Main Deck to the controller's trash (441.1 puts cards into
 * the trash without Burning Out).
 */
registerCustomEffect("ven:trash-rest-of-looked", (params, context) => {
  const ctx = evalContextOf(context);
  const keep = typeof params.keep === "string" ? refIds(ctx, params.keep) : [];
  const moved: string[] = [];
  for (const id of refIds(ctx, "looked")) {
    if (keep.includes(id)) continue;
    if (context.step.host.moveCardTo(context.room, context.controller, "deck", "trash", id))
      moved.push(id);
  }
  recordOutcome(context, moved, moved.length > 0);
  return RESOLVED;
});

const DISEMPOWER_COST_GAP =
  "'Disempower this' is a cost (357.2) but the Cost shape has no disempower part, so it is paid on resolution; the ability is rejected unless the source is Empowered.";

/* ---------------------------------------------------------------- units */

registerCardScript({
  name: "Affectionate Poro",
  text: "When a combat that I was in ends, if I haven't been dealt damage this turn, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      // 468.7.b `combat_end` at my battlefield; `damagedThisTurn` is the engine's 'dealt damage' flag.
      trigger: { kind: "event", event: { type: "combat_end", zone: HERE } },
      condition: custom("ven:self-not-damaged-this-turn"),
      effect: { op: "draw", amount: 1 },
    },
  ],
});

registerCardScript({
  name: "Ol' Poro",
  text: "I can't be played on your first, second or third turns.",
  status: "manual",
  notes:
    "A 'can't be played' restriction printed on a card in hand (054.1) is not consulted: `restrictionFor` only reads board passives. See the [BUG] reproduction in test/cards/ven-ogs/batch4-more.test.ts.",
  abilities: [],
});

registerCardScript({
  name: "Ocean Drake",
  text: "You may play me to an open battlefield.\nWhen you play me, you may return a non-Dragon unit to its owner's hand.",
  status: "partial",
  notes:
    "'You may play me to an open battlefield' (355.2 Location) is not automated; the return effect is.",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: {
        op: "return_to_hand",
        target: aUnit({ where: not(custom("ven:has-tag", { tag: "Dragon" })) }),
      },
    },
  ],
});

registerCardScript({
  name: "Hungry Wolf",
  text: "[Calm]: Ready me and give me +1 [Might] this turn. Use only if you've chosen an enemy unit this turn and only once each turn.",
  status: "partial",
  notes:
    "'Use only if you've chosen an enemy unit this turn' needs a per-turn record of choices that the engine does not keep; the once-per-turn limit and the effect are automated.",
  abilities: [
    {
      kind: "activated",
      cost: { power: { Calm: 1 } },
      limit: { kind: "once-per-turn" },
      effect: {
        op: "seq",
        effects: [
          { op: "ready", target: SELF },
          { op: "temporary_might", amount: 1, target: SELF },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Kennen, Storm of Shuriken",
  text: "When you play me, [Burn 2]. (Put the top 2 cards of your Main Deck into your trash.)\nWhen I conquer, give a spell in your trash [Flow] equal to its cost this turn. (You may play it from your trash for its Flow cost. Then banish it.)",
  status: "partial",
  notes: `${FLOW_GAP} 'Give a spell in your trash [Flow] equal to its cost' is therefore not automated; the Burn 2 is.`,
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "burn", amount: 2, target: {} } },
  ],
});

registerCardScript({
  name: "Zed, Without a Sound",
  text: 'When I conquer, play a 0 [Might] Shadow Clone unit token to your base. (It has "When I attack, you may banish a unit from your trash. If you do, give me [Assault 4] this turn.")\n[Action] [1][Chaos]: Move me and a Shadow Clone you control to each other\'s locations.',
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_CONQUER,
      effect: {
        op: "create",
        token: token("Shadow Clone", { might: 0, play: true, zone: "base" }),
      },
    },
    {
      kind: "activated",
      cost: { energy: 1, power: { Chaos: 1 } },
      keywords: ["action"],
      effect: {
        op: "swap",
        a: SELF,
        b: {
          chosen: true,
          cardType: "unit",
          name: "Shadow Clone",
          controller: "self",
          targetRef: "target:0",
        },
        property: "zone",
      },
    },
  ],
});

/* ---------------------------------------------------------------- spells */

registerCardScript({
  name: "Death Mark",
  text: '[Burn 3]. (Put the top 3 cards of your Main Deck into your trash.)\nPlay a 0 [Might] Shadow Clone unit token. (It has "When I attack, you may banish a unit from your trash. If you do, give me [Assault 4] this turn.")\n[Flow][1][Rune][Rune] (You may play this from your trash for its Flow cost. Then banish it.)',
  status: "partial",
  notes: FLOW_GAP,
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "burn", amount: 3, target: {} },
          { op: "create", token: token("Shadow Clone", { might: 0, play: true }) },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Lightning Rush",
  text: "Look at the top 3 cards of your Main Deck. You may choose a card from among them and draw it. Put the rest into your trash.\n[Flow][2][Rune] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "partial",
  notes: FLOW_GAP,
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "look",
        amount: 3,
        then: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "drawn",
              selector: { zone: "deck", where: custom("in-ref", { ref: "looked" }) },
              min: 0,
              max: 1,
              label: "Choose a card to draw",
            },
            // "Put the rest into your trash": every looked-at card but the chosen one; the chosen
            // card is then the top of the Main Deck (looked-at cards are its top cards).
            { op: "custom", id: "ven:trash-rest-of-looked", params: { keep: "drawn" } },
            {
              op: "draw",
              amount: { kind: "count", selector: { targetRef: "drawn", zone: "deck" } },
            },
          ],
        },
      },
    },
  ],
});

/* ---------------------------------------------------------------- gear */

registerCardScript({
  name: "Questionable Tome",
  text: "[Empower] - [Tap] (Pay the cost: Empower me. Use only if not Empowered.)\nDisempower this, [1], [Tap]: Draw 1.",
  status: "partial",
  notes: DISEMPOWER_COST_GAP,
  abilities: [
    empower({ exhaust: SELF }),
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: {
        op: "requires",
        condition: SELF_EMPOWERED,
        rule: "357.2",
        effect: {
          op: "seq",
          effects: [
            { op: "disempower", target: SELF },
            { op: "draw", amount: 1 },
          ],
        },
      },
    },
  ],
});

registerCardScript({
  name: "Hextech Disc",
  text: "[Empower] - [Tap] (Pay the cost: Empower this. Use only if not Empowered.)\nDisempower this, [1], [Tap]: Play a 3 [Might] Mech unit token to your base.",
  status: "partial",
  notes: DISEMPOWER_COST_GAP,
  abilities: [
    empower({ exhaust: SELF }),
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: {
        op: "requires",
        condition: SELF_EMPOWERED,
        rule: "357.2",
        effect: {
          op: "seq",
          effects: [
            { op: "disempower", target: SELF },
            { op: "create", token: token("Mech", { might: 3, play: true, zone: "base" }) },
          ],
        },
      },
    },
  ],
});

void conditional;
