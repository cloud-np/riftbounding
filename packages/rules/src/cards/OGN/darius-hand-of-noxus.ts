/**
 * Darius, Hand of Noxus (OGN-253, legend) — "[Tap] [REACTION], [LEGION] - [ADD] [1]"
 *
 * An Add ability (430.2, 430.5) that exists only while Legion is satisfied (812.1.c: you have
 * Finalized a card this turn; a legend is never that card) — modelled as a 377.2.b precondition.
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";
import { LEGION } from "./darius-executioner";

registerCardScript({
  name: "Darius, Hand of Noxus",
  text: "[Tap] [REACTION], [LEGION] - [ADD] [1] (Abilities that add resources can't be reacted to. Get the effect if you've played a card this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["reaction"],
      addsResources: true,
      effect: {
        op: "requires",
        condition: LEGION,
        rule: "812.1.c",
        effect: { op: "add", resources: { energy: 1 } },
      },
    },
  ],
});
