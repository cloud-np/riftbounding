/**
 * Radiance (RAD) battlefields (wave R3). A battlefield's "you" is the player the event belongs to
 * (`triggers/detect.ts`: battlefield sources act for the event's player); "here" is the
 * battlefield itself (053.3).
 */
import { notIntrinsic, oncePerPlayerPerTurn } from "./dsl";
import { aUnit, custom, HERE, registerCardScript, token, WHEN_YOU_CONQUER_HERE, WHEN_YOU_DEFEND_HERE, WHEN_YOU_HOLD_HERE } from "../sdk";

/** Bandle Scouts' Academy (RAD-157) — "When you hide a card here, play a Gold gear token exhausted." (422, 811.1.b) */
registerCardScript({
  name: "Bandle Scouts' Academy",
  text: 'When you hide a card here, play a Gold gear token exhausted. (It has "[Reaction] Kill this, [Tap]: [Add] [Rune].")',
  status: "implemented",
  abilities: [
    ...notIntrinsic("Reaction", "Add"),
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "hide", zone: HERE, player: "self" } },
      effect: { op: "create", token: token("Gold", { exhausted: true, play: true }) },
    },
  ],
});

/**
 * Black Rose Sanctum (RAD-159) — "For each player, the first time each turn a non-token unit they
 * control dies here, they play a 1 [Might] Recruit unit token to their base."
 */
const SANCTUM = oncePerPlayerPerTurn("rad:black-rose:{self}", {
  op: "create",
  token: token("Recruit", { might: 1, play: true }),
  zone: "base",
});
registerCardScript({
  name: "Black Rose Sanctum",
  text: "For each player, the first time each turn a non-token unit they control dies here, they play a 1 [Might] Recruit unit token to their base.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "die",
          zone: HERE,
          subject: { cardType: "unit" },
          condition: {
            kind: "and",
            conditions: [custom("rad:event-not-token"), SANCTUM.condition],
          },
        },
      },
      effect: SANCTUM.effect,
    },
  ],
});

/** Cosmic Vista (RAD-160) — "When you hold here, if your Rune Deck is empty, you score 1 point." (383.2.a.1, 470.2) */
const RUNE_DECK_EMPTY = {
  kind: "compare" as const,
  left: { kind: "cards-in-zone" as const, zone: "runeDeck" },
  op: "eq" as const,
  right: 0,
};
registerCardScript({
  name: "Cosmic Vista",
  text: "When you hold here, if your Rune Deck is empty, you score 1 point.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      condition: RUNE_DECK_EMPTY,
      effect: { op: "if", condition: RUNE_DECK_EMPTY, then: { op: "score_points", amount: 1 } },
    },
  ],
});

/** Durand Memorial (RAD-161) — "When you defend here, choose a unit you control here. Give it [Tank] this combat." (383.4.f, 815) */
registerCardScript({
  name: "Durand Memorial",
  text: "When you defend here, choose a unit you control here. Give it [Tank] this combat. (It must be assigned combat damage first.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Tank"),
    {
      kind: "triggered",
      trigger: WHEN_YOU_DEFEND_HERE,
      effect: {
        op: "grant_keyword",
        keyword: "Tank",
        target: aUnit({ controller: "self", zone: HERE }),
        duration: "this-combat",
      },
    },
  ],
});

/**
 * Rakelstake (RAD-165) — "For each player, the first time they play a unit or gear here each turn,
 * they [Predict]." (440.2.c: playing a token counts)
 */
const RAKEL = oncePerPlayerPerTurn("rad:rakelstake:{self}", { op: "predict", amount: 1 });
registerCardScript({
  name: "Rakelstake",
  text: "For each player, the first time they play a unit or gear here each turn, they [Predict]. (They look at the top card of their Main Deck. They may recycle it.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Predict"),
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: ["unit_played", "gear_played"], zone: HERE, condition: RAKEL.condition },
      },
      effect: RAKEL.effect,
    },
  ],
});

/** Ruined Monastery (RAD-166) — "When you conquer here, you may discard 1 and channel 1 rune exhausted." */
registerCardScript({
  name: "Ruined Monastery",
  text: "When you conquer here, you may discard 1 and channel 1 rune exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      effect: {
        op: "may",
        effect: {
          op: "seq",
          effects: [
            { op: "discard", amount: 1 },
            { op: "channel", amount: 1, exhausted: true },
          ],
        },
      },
    },
  ],
});
