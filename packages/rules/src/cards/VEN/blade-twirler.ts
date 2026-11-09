/** Blade Twirler. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Blade Twirler",
  text: "The first time I move each turn, choose a player. They [Burn 1]. (They put the top card of their Main Deck into their trash.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "move", subject: SELF } },
      limit: { kind: "once-per-turn" },
      effect: {
        op: "seq",
        effects: [
          // 355.7: the player is chosen when the trigger finalizes; the zero draw only binds it.
          { op: "draw", amount: 0, player: { kind: "chosen", ref: "player" } },
          { op: "burn", amount: 1, target: { controller: { kind: "chosen", ref: "player" } } },
        ],
      },
    },
  ],
});
