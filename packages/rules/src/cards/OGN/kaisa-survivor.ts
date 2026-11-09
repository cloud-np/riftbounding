/** Kai'Sa, Survivor (OGN-039) — [Accelerate] (805, R2-play); "When I conquer, draw 1." (383.4.c) */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Kai'Sa, Survivor",
  text: "[ACCELERATE] (You may pay [1] [FURY] as an additional cost to have me enter ready.)\nWhen I conquer, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "conquer", subject: SELF } },
      effect: { op: "draw", amount: 1 },
    },
  ],
});
