/** Rek'Sai, Swarm Queen. */
import { registerCardScript, WHEN_I_ATTACK } from "../sdk";
import { HERE_ZONE } from "./custom";

registerCardScript({
  name: "Rek'Sai, Swarm Queen",
  text: "When I attack, you may reveal the top 2 cards of your Main Deck. You may banish one, then play it. If it is a unit, you may play it here. Recycle the rest.",
  status: "partial",
  notes:
    '"If it is a unit, you may play it here": a banished unit is always played here when that is possible; the choice of playing it to base instead (355.2.b) is not offered.',
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      optional: true,
      effect: {
        op: "custom",
        id: "sfd:reveal-banish-play",
        params: { reveal: 2, rest: "recycle", location: HERE_ZONE },
      },
    },
  ],
});
