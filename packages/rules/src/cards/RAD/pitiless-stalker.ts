/** Pitiless Stalker (RAD-104) — "[Tap]: [Stun] an enemy unit." (424) */
import { aUnit, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Pitiless Stalker",
  text: "[Tap]: [Stun] an enemy unit. (It doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: { op: "stun", target: aUnit({ controller: "opponent" }) },
    },
  ],
});
