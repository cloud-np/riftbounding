/**
 * Mushroom Pouch (OGN-101) — "At the start of your Beginning Phase, if you control a facedown card
 * at a battlefield, draw 1." The "if" right after the trigger condition is part of it (383.2.a.1).
 */
import type { Condition } from "@rift/protocol";
import { registerCardScript } from "../registry";
import { registerCustomCondition } from "../../effects/evaluate";

/** 107.3 / 811: the controller has a facedown (hidden) card at a battlefield. */
registerCustomCondition("ogn-an:controls-facedown-at-battlefield", (ctx) =>
  ctx.host
    .battlefieldZones(ctx.room)
    .some((zone) =>
      ctx.host.zoneCards(ctx.room, ctx.env.controller, zone).some((card) => card.hidden === true),
    ),
);

export const CONTROLS_FACEDOWN: Condition = {
  kind: "custom",
  id: "ogn-an:controls-facedown-at-battlefield",
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
