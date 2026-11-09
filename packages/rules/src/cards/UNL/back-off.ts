/**
 * Back Off (UNL-042) — [Hidden] (811) and [Action] (806) are engine keywords. "[Stun] a unit. If
 * you played this from your hand, draw 1." — not when played from facedown (811.1.b).
 */
import { aUnit, custom, registerCardScript } from "../sdk";

registerCardScript({
  name: "Back Off",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\n[Action] (Play on your turn or in showdowns.)\n[Stun] a unit. (It doesn't deal combat damage this turn.)\nIf you played this from your hand, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "stun", target: aUnit() },
          { op: "if", condition: custom("unl:played-from-hand"), then: { op: "draw", amount: 1 } },
        ],
      },
    },
  ],
});
