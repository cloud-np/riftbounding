/**
 * Invigorating Bloom (RAD-035) — "When you play this, give a friendly unit +3 [Might] this turn.
 * Exhaust a friendly [Mighty] unit, [Tap]: Draw 1."
 */
import { aUnit, notIntrinsic, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Invigorating Bloom",
  text: "When you play this, give a friendly unit +3 [Might] this turn.\nExhaust a friendly [Mighty] unit, [Tap]: Draw 1. (A unit is Mighty while it has 5+ [Might].)",
  status: "partial",
  notes:
    "The activated ability's cost exhausts two objects (a friendly Mighty unit and this); `Cost.exhaust` holds one selector (357.2).",
  abilities: [
    ...notIntrinsic("Mighty"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "temporary_might", amount: 3, target: aUnit({ controller: "self" }) },
    },
  ],
});
