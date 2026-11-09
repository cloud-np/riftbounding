/** Trevor Snoozebottom. */
import { HERE, registerCardScript, SELF, token } from "../sdk";

registerCardScript({
  name: "Trevor Snoozebottom",
  text: "[shield] (+1 [Might] while I'm a defender.)\nWhen I hold, play a ready 3 [might] Sprite unit token with [temporary] here. (Kill it at the start of its controller's next Beginning Phase, before scoring.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Temporary" },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "hold", subject: SELF } },
      effect: {
        op: "create",
        token: token("Sprite", { might: 3, exhausted: false, play: true }),
        zone: HERE,
      },
    },
  ],
});
