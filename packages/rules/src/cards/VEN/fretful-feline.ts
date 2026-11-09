/** Fretful Feline. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Fretful Feline",
  text: "When I become ready, give me +2[Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "ready", subject: SELF } },
      effect: { op: "temporary_might", amount: 2, target: SELF },
    },
  ],
});
