/**
 * Scrutinizing Scope (RAD-064) — "[1], [Tap]: Choose an opponent. They guess a card type. Reveal
 * the top card of your Main Deck. If it has that type, recycle it. Otherwise, draw it."
 */
import { registerCardScript, SELF } from "../sdk";
import { CHOOSE_OPPONENT } from "./custom";

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
