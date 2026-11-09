/**
 * Facebreaker (OGN-220) — "[hidden] [action] Stun a friendly unit and an enemy unit at the same
 * battlefield." (424; two targets, the second at the first one's battlefield; Hidden 811 is R2-play's)
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Facebreaker",
  text: "[hidden] (Hide now for [power] to react with later for [0].)\n\n[action] (play on your turn or in showdowns.)\n\nStun a friendly unit and an enemy unit at the same battlefield. (They don't deal combat damage this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "stun",
            target: aUnit({ controller: "self", zone: "battlefield", targetRef: "target:0" }),
          },
          {
            op: "stun",
            target: aUnit({
              controller: "opponent",
              zone: "battlefield",
              sameLocationAs: "target:0",
              targetRef: "target:1",
            }),
          },
        ],
      },
    },
  ],
});
