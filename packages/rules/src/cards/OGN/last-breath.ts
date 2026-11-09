/**
 * Last Breath (OGN-260) — "Ready a friendly unit. It deals damage equal to its Might to an enemy
 * at a battlefield." (416; 418.6.b: the unit is the damage source; only units take damage.)
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Last Breath",
  text: "[ACTION] (Play on your turn or in showdowns.)\nReady a friendly unit. It deals damage equal to its Might to an enemy at a battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "ready", target: aUnit({ controller: "self", targetRef: "target:0" }) },
          {
            op: "deal",
            amount: { kind: "might", selector: { targetRef: "target:0" } },
            target: aUnit({ controller: "opponent", zone: "battlefield", targetRef: "target:1" }),
            source: { targetRef: "target:0" },
          },
        ],
      },
    },
  ],
});
