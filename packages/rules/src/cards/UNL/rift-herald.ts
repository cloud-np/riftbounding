/** Rift Herald. */
import { registerCardScript, SELF } from "../sdk";
import { lookRevealDraw } from "./custom";

registerCardScript({
  name: "Rift Herald",
  text: "When I move to a battlefield, look at the top 3 cards of your Main Deck, You may reveal a unit from among them and draw it. Recycle the rest.\n[Deathknell] Play a unit from your hand to your base, ignoring its Energy cost (When I die, get the effect, You must still pay its Power cost.)",
  status: "partial",
  notes:
    "The [Deathknell] play is not automated: a limited play can ignore the whole cost or pay only Energy, but not 'ignore the Energy cost and still pay the Power cost' (420.3.b, 357).",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "move",
          subject: SELF,
          condition: { kind: "event-zone-is", battlefield: true },
        },
      },
      effect: lookRevealDraw(3, { cardType: "unit" }),
    },
  ],
});
