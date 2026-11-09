/**
 * Radiance (RAD) Bomb makers and remaining automatable cards (wave R3).
 *
 * Bomb gear token (RAD-T02): "[Deploy] [Deathknell] Deal 2 to an enemy unit here and kill all
 * other Bombs you control here." Its creation is scripted here; its own script lives in
 * `src/cards/tokens/bomb.ts` (Deploy 830 + Deathknell "here" 808 / 383.2.c.3.b).
 */
import type { Effect } from "@rift/protocol";
import { registerCardScript } from "../registry";
import { registerAdditionalCosts } from "../../play/additional-costs";
import { PAID_ADDITIONAL, SELF, WHEN_PLAYED, aUnit, custom, token } from "../dsl";
import { CHOOSE_OPPONENT, X_NUMBER, letX, zoneRef } from "./dsl";
import { WHEN_I_HOLD } from "../lib/triggers";

const BOMB_NOTE =
  "The Bomb token's own [Deathknell] (deal 2, kill your other Bombs there) needs a token script (src/cards/tokens, 187).";

function playBombs(count: number, ref = "bomb"): Effect {
  return {
    op: "create",
    token: token("Bomb", { ...(count > 1 ? { count } : {}), play: true }),
    zone: zoneRef(ref),
  };
}

/** Amateur Demolitionist (RAD-001) — "When you play me, play a Bomb gear token to a battlefield." (440.2.c, 830.1.b) */
registerCardScript({
  name: "Amateur Demolitionist",
  text: "When you play me, play a Bomb gear token to a battlefield. (It has [Deploy]. When it dies, deal 2 to an enemy there and kill your other Bombs there.)",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_PLAYED, effect: playBombs(1) }],
});

/** Explosimian (RAD-094) — "When I hold, play three Bomb gear tokens to a single battlefield." */
registerCardScript({
  name: "Explosimian",
  text: "When I hold, play three Bomb gear tokens to a single battlefield. (They have [Deploy]. When each dies, deal 2 to an enemy there and kill your other Bombs there.)",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_I_HOLD, effect: playBombs(3) }],
});

/** Satchel Charge (RAD-096) — "Move a friendly unit, then play a Bomb gear token to a battlefield." */
registerCardScript({
  name: "Satchel Charge",
  text: "[Action] (Play on your turn or in showdowns.)\nMove a friendly unit, then play a Bomb gear token to a battlefield. (It has [Deploy]. When it dies, deal 2 to an enemy there and kill your other Bombs there.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "move", target: aUnit({ controller: "self" }), to: zoneRef("destination") },
          playBombs(1),
        ],
      },
    },
  ],
});

/**
 * Hexplosive Minefield (RAD-142) — "Kill any number of friendly Bomb tokens. At end of turn, play
 * that many Bomb tokens to a single battlefield." (390–393: the delayed trigger's battlefield is
 * chosen when it triggers, 355.5.b)
 */
registerCardScript({
  name: "Hexplosive Minefield",
  text: "[Action] (Play on your turn or in showdowns.)\nKill any number of friendly Bomb tokens. At end of turn, play that many Bomb tokens to a single battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "kill",
            target: { chosen: true, name: "Bomb", token: true, controller: "self", maxCount: 99 },
          },
          letX(
            { amount: { kind: "count", selector: { targetRef: "it" } } },
            {
              op: "delayed",
              trigger: { kind: "turn-end" },
              effect: {
                op: "create",
                token: token("Bomb", { count: X_NUMBER, play: true }),
                zone: zoneRef("bomb"),
              },
            },
          ),
        ],
      },
    },
  ],
});

/**
 * Ziggs, Explosive (RAD-112) — "[1], [Tap]: Play a Bomb gear token to a battlefield. When I defend,
 * you may kill a friendly gear to give me +2 [Might] this turn."
 */
registerCardScript({
  name: "Ziggs, Explosive",
  text: "[1], [Tap]: Play a Bomb gear token to a battlefield. (It has [Deploy]. When it dies, deal 2 to an enemy there and kill your other Bombs there.)\nWhen I defend, you may kill a friendly gear to give me +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    { kind: "activated", cost: { energy: 1, exhaust: SELF }, effect: playBombs(1) },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "defend", subject: SELF } },
      effect: {
        op: "may",
        effect: {
          op: "seq",
          effects: [
            { op: "choose", key: "victim", selector: { cardType: "gear", controller: "self" } },
            { op: "kill", target: { targetRef: "victim" } },
            {
              op: "if",
              condition: custom("did"),
              then: { op: "temporary_might", amount: 2, target: SELF },
            },
          ],
        },
      },
    },
  ],
});

/** Ziggs, Hexplosives Expert (RAD-141, legend) — "[1][Rune], [Tap]: Play a Bomb gear token to a battlefield." */
registerCardScript({
  name: "Ziggs, Hexplosives Expert",
  text: "[1][Rune], [Tap]: Play a Bomb gear token to a battlefield. (It has [Deploy]. When it dies, deal 2 to an enemy there and kill your other Bombs there.)",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { energy: 1, power: { any: 1 }, exhaust: SELF },
      effect: playBombs(1),
    },
  ],
});

/** Ziggs, Short-Fused (RAD-023) — "When you play me, play a Bomb gear token to a battlefield. Abilities of friendly gear deal 1 Bonus Damage." */
registerCardScript({
  name: "Ziggs, Short-Fused",
  text: "When you play me, play a Bomb gear token to a battlefield. (It has [Deploy]. When it dies, deal 2 to an enemy there and kill your other Bombs there.)\nAbilities of friendly gear deal 1 Bonus Damage.",
  status: "partial",
  notes: `${BOMB_NOTE} "Abilities of friendly gear deal 1 Bonus Damage" needs a source-type filter on Bonus Damage (712–715; \`bonus-damage\` only filters spells/abilities).`,
  abilities: [{ kind: "triggered", trigger: WHEN_PLAYED, effect: playBombs(1) }],
});

/**
 * Scrutinizing Scope (RAD-064) — "[1], [Tap]: Choose an opponent. They guess a card type. Reveal
 * the top card of your Main Deck. If it has that type, recycle it. Otherwise, draw it."
 */
registerCardScript({
  name: "Scrutinizing Scope",
  text: "[1], [Tap]: Choose an opponent. They guess a card type. Reveal the top card of your Main Deck. If it has that type, recycle it. Otherwise, draw it. (Unit, gear, and spell are types.)",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: {
        op: "seq",
        effects: [
          CHOOSE_OPPONENT,
          {
            op: "custom",
            id: "rad:scope-guess",
            params: { player: { kind: "chosen", ref: "opponent" } },
          },
        ],
      },
    },
  ],
});

/**
 * Shimmering Swimmer (RAD-014) — "You may kill a friendly unit or gear as an additional cost to
 * play me. When you play me, if you paid the additional cost, deal 2 to a unit." (204.2, 356.2.b,
 * 383.2.a.1) The printed phrase "kill a friendly unit or gear" is registered as the card's optional
 * additional cost (a cost selector without a card type matches units and gear at locations).
 */
registerAdditionalCosts("Shimmering Swimmer", [
  {
    id: "optional:0",
    optional: true,
    cost: { kill: { controller: "self" } },
    rule: "356.2.b.1",
    label: "Kill a friendly unit or gear",
  },
]);
registerCardScript({
  name: "Shimmering Swimmer",
  text: "You may kill a friendly unit or gear as an additional cost to play me.\nWhen you play me, if you paid the additional cost, deal 2 to a unit.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: { op: "deal", amount: 2, target: aUnit() },
    },
  ],
});
