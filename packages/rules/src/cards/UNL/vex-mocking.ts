/** Vex, Mocking. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Vex, Mocking",
  text: "[Shield] (+1 [Might] while I'm a defender.)\n[Tank] (I must be assigned combat damage first.)\nWhen you [Stun] an enemy unit at a battlefield, you may move me to that battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "stun",
          player: "self",
          condition: {
            kind: "exists",
            selector: { targetRef: "event", controller: "opponent", zone: "battlefield" },
          },
        },
      },
      optional: true,
      effect: { op: "custom", id: "unl:move-to-event-subject" },
    },
  ],
});
