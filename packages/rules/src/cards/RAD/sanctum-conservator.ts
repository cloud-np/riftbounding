/** Sanctum Conservator (RAD-030) — "When you play a card with Energy cost [7] or more, ready me." (420.4.a) */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Sanctum Conservator",
  text: "When you play a card with Energy cost [7] or more, ready me.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "played", player: "self", subject: { energyCost: { op: "gte", value: 7 } } },
      },
      effect: { op: "ready", target: SELF },
    },
  ],
});
