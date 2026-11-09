/** Fretful Feline. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Fretful Feline",
  text: "When I become ready, give me +2[Might] this turn.",
  status: "partial",
  notes:
    "Triggers when an effect readies me (416); the Beginning Phase 'ready all' (315.1) emits one `ready_all` event and no per-object `ready` events, so it does not trigger there.",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "ready", subject: SELF } },
      effect: { op: "temporary_might", amount: 2, target: SELF },
    },
  ],
});
