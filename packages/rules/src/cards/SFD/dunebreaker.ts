/** Dunebreaker. */
import { enterReady, registerCardScript, WHEN_I_HOLD } from "../sdk";

registerCardScript({
  name: "Dunebreaker",
  text: "If you have two or fewer cards in your hand, I enter ready.\nWhen I hold, draw 2.",
  status: "implemented",
  abilities: [
    enterReady({ kind: "compare", left: { kind: "cards-in-hand" }, op: "lte", right: 2 }),
    { kind: "triggered", trigger: WHEN_I_HOLD, effect: { op: "draw", amount: 2 } },
  ],
});
