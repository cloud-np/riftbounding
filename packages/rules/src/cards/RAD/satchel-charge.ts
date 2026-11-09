/** Satchel Charge (RAD-096) — "Move a friendly unit, then play a Bomb gear token to a battlefield." */
import { aUnit, registerCardScript } from "../sdk";
import { playBombs, zoneRef } from "./custom";

registerCardScript({
  name: "Satchel Charge",
  text: "[Action] (Play on your turn or in showdowns.)\nMove a friendly unit, then play a Bomb gear token to a battlefield. (It has [Deploy]. When it dies, deal 2 to an enemy there and kill your other Bombs there.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "move", target: aUnit({ controller: "self" }), to: zoneRef("destination") },
          playBombs(1),
        ],
      },
    },
  ],
});
