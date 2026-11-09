/** Ki Burst (RAD-028) — "As an additional cost to play this, exhaust a friendly unit. [Stun] a unit." */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Ki Burst",
  text: "[Action] (Play on your turn or in showdowns.)\n As an additional cost to play this, exhaust a friendly unit.\n[Stun] a unit. (It doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "stun", target: aUnit() } }],
});
