/** Ivern, Nurturer. */
import type { Effect } from "@rift/protocol";
import { aUnit, custom, registerCardScript, SELF, WHEN_PLAYED } from "../sdk";
import { lookRevealDraw, PETS } from "./custom";

const NURTURE: Effect = {
  op: "seq",
  effects: [
    lookRevealDraw(3, { cardType: "unit" }, "kept"),
    {
      op: "if",
      condition: custom("unl:ref-has-any-tag", { ref: "kept", tags: PETS }),
      then: { op: "reflexive", effect: { op: "buff", target: aUnit({ controller: "self" }) } },
    },
  ],
};

registerCardScript({
  name: "Ivern, Nurturer",
  text: "When you play me or when I hold, look at the top 3 cards of your Main Deck. You may reveal a unit from among them and draw it. Recycle the rest. If you revealed a Bird, Cat, Dog or Poro, do this: [Buff] a friendly unit. (Give it a +1 [Might] buff if it doesn't have one.)",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: NURTURE },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "hold", subject: SELF } },
      effect: NURTURE,
    },
  ],
});
