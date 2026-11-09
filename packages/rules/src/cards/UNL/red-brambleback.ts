/** Red Brambleback. */
import { aUnit, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Red Brambleback",
  text: "[Accelerate] (You may pay [1][Fury] as an additional cost to have me enter ready.)\nYour conquer effects for conquering here trigger an additional time.\nWhen I conquer, [Buff] a friendly unit. (Give it a +1[Might] buff if it doesn't have one.)",
  status: "partial",
  notes:
    "'Your conquer effects for conquering here trigger an additional time' is not automated: the trigger detector has no way to make triggers fire an additional time (383.1.b, 383.4.c); only my own conquer Buff is.",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "conquer", subject: SELF } },
      effect: { op: "buff", target: aUnit({ controller: "self" }) },
    },
  ],
});
