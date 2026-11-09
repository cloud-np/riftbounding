/**
 * Unleashed units that look at the top of the Main Deck (425 look/reveal, 414 draw, 417 recycle,
 * 417.5 random order) or return cards from the trash:
 *
 * - Fate Weaver (UNL-064): play effect — top 4, may reveal a spell with Energy cost 4+ and draw it.
 * - Ivern, Nurturer (UNL-051): when you play me or when I hold — top 3, may reveal a unit and draw
 *   it; if it was a Bird, Cat, Dog or Poro, "do this" (387 reflexive): [Buff] a friendly unit.
 * - Starhound (UNL-167): play effect — return a Bird, Cat, Dog, or Poro from your trash to hand.
 */
import type { Effect } from "@rift/protocol";
import { registerCardScript } from "../registry";
import { SELF, WHEN_PLAYED, aUnit, custom } from "../dsl";
import { lookRevealDraw } from "./dsl-unl";

const PETS = ["Bird", "Cat", "Dog", "Poro"];

registerCardScript({
  name: "Fate Weaver",
  text: "When you play me, look at the top 4 cards of your Main Deck. You may reveal a spell with Energy cost [4] or more from among them and draw it.\nRecycle the rest.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: lookRevealDraw(4, { cardType: "spell", energyCost: { op: "gte", value: 4 } }),
    },
  ],
});

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

registerCardScript({
  name: "Starhound",
  text: "When you play me, return a Bird, Cat, Dog, or Poro from your trash to your hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "return_to_hand",
        target: {
          chosen: true,
          zone: "trash",
          controller: "self",
          where: custom("unl:it-has-any-tag", { tags: PETS }),
        },
      },
    },
  ],
});
