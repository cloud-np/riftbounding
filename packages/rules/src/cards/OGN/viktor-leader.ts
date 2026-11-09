/** Viktor, Leader (OGN-246 — EX[161] (383.2.c.2)) */
import { registerCardScript, token } from "../sdk";

registerCardScript({
  name: "Viktor, Leader",
  text: "When another non-Recruit unit you control dies, play a 1 [Might] Recruit unit token into your base.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "die",
          subject: {
            cardType: "unit",
            controller: "self",
            excludeSource: true,
            where: { kind: "not", condition: { kind: "exists", selector: { targetRef: "it", tag: "Recruit" } } },
          },
        },
      },
      effect: { op: "create", token: token("Recruit", { might: 1, play: true }), zone: "base" },
    },
  ],
});
