/**
 * Mushroom Pouch (OGN-101) — "At the start of your Beginning Phase, if you control a facedown card
 * at a battlefield, draw 1." The "if" right after the trigger condition is part of it (383.2.a.1).
 */
import type { Condition } from "@rift/protocol";
import { registerCardScript } from "../sdk";

export const CONTROLS_FACEDOWN: Condition = {
  kind: "custom",
  id: "ogn:controls-facedown-at-battlefield",
};

registerCardScript({
  name: "Mushroom Pouch",
  text: "At the start of your Beginning Phase, if you control a facedown card at a battlefield, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "beginning" },
      condition: CONTROLS_FACEDOWN,
      effect: { op: "draw", amount: 1 },
    },
  ],
});
