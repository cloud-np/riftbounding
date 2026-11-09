/** Noxus Hopeful (OGN-012 — EX[277] (727.1): [Legion] I cost [2] less (366.2.a: applies from the hand).) */
import { custom, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Noxus Hopeful",
  text: "[LEGION] I cost [2] less. (Get the effect if you've played another card this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "while", condition: { kind: "cards-played", op: "gte", value: 1 }, modifier: { kind: "cost", amount: -2, target: SELF } },
    },
  ],
});
