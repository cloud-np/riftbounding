/**
 * Evelynn, Agony's Embrace (RAD-153/175, legend) — "Once each turn, when you play a card from
 * face down, draw 1. Then, if it's not your turn, discard 1."
 *
 * 811.6 / 383.4.a: the play event (`card_played`, emitted for spells, units and gear when they
 * finalize) carries `data.playedFromFacedown`, so the trigger is detected like Evelynn,
 * Entrancing's. "Once each turn" is the trigger limit (383.3.e.1); the discard (423.1.a: the player
 * chooses) only happens when the card was played on another player's turn.
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Evelynn, Agony's Embrace",
  text: "Once each turn, when you play a card from face down, draw 1. Then, if it's not your turn, discard 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "card_played", player: "self", data: { playedFromFacedown: true } },
      },
      limit: { kind: "once-per-turn" },
      effect: {
        op: "seq",
        effects: [
          { op: "draw", amount: 1 },
          {
            op: "if",
            condition: { kind: "not", condition: { kind: "is-turn-player", player: "self" } },
            then: { op: "discard", amount: 1 },
          },
        ],
      },
    },
  ],
});
