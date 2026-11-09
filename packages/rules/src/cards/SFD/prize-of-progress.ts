/** Prize of Progress. */
import { custom, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Prize of Progress",
  text: "When you use an activated ability of a gear, give me +1 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "ability_activated",
          player: "self",
          condition: custom("sfd:event-source-gear"),
        },
      },
      effect: { op: "temporary_might", amount: 1, target: SELF },
    },
  ],
});
