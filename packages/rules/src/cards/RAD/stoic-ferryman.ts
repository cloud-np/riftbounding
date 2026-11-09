/** Stoic Ferryman. */
import type { Condition } from "@rift/protocol";
import { aUnit, HERE, registerCardScript, WHEN_PLAYED } from "../sdk";

/** Stoic Ferryman (RAD-031) — "[Shield 3] When you play me to a battlefield, you may move another unit you control here to your base." */
const PLAYED_TO_BATTLEFIELD: Condition = { kind: "event-zone-is", battlefield: true };

registerCardScript({
  name: "Stoic Ferryman",
  text: "[Shield 3] (+3 [Might] while I'm a defender.)\nWhen you play me to a battlefield, you may move another unit you control here to your base.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PLAYED_TO_BATTLEFIELD,
      effect: {
        op: "may",
        effect: {
          op: "move",
          target: aUnit({ controller: "self", excludeSource: true, zone: HERE }),
          to: "base",
        },
      },
    },
  ],
});
