/** Gutter Palace. */
import { registerCardScript, SELF, token } from "../sdk";

registerCardScript({
  name: "Gutter Palace",
  text: "At the start of your Beginning Phase, if you have exactly 4 cards in hand and exactly 4 units at battlefields, you win the game.\nDiscard 1, [tap] : Play a 1 [might] Bird unit Token with [deflect] . (Opponents must pay [rune] to choose it with a spell or ability.)",
  status: "partial",
  notes:
    "The win condition is not automated: there is no effect that wins the game (a Victory outside scoring, 470.1 / 105); only the Bird-making ability is. The catalog's [Deflect] is the token's (suppressed).",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Deflect" },
    {
      kind: "activated",
      cost: { discard: 1, exhaust: SELF },
      effect: { op: "create", token: token("Bird", { might: 1, play: true }), zone: "base" },
    },
  ],
});
