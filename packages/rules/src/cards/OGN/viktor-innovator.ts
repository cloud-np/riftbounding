/**
 * Viktor, Innovator (OGN-117) — "When you play a card on an opponent's turn, play a 1 [Might]
 * Recruit unit token in your base."
 *
 * 420.4.a: triggers when the played card has resolved. 185: tokens are not cards, so a played
 * token does not trigger it. "On an opponent's turn": you are not the Turn Player.
 */
import { not, registerCardScript, token } from "../sdk";

registerCardScript({
  name: "Viktor, Innovator",
  text: "When you play a card on an opponent's turn, play a 1 [Might] Recruit unit token in your base.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "played",
          player: "self",
          subject: { token: false },
          condition: not({ kind: "is-turn-player" }),
        },
      },
      effect: { op: "create", token: token("Recruit", { might: 1, play: true }), zone: "base" },
    },
  ],
});
