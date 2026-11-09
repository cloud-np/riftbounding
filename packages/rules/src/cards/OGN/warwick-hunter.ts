/**
 * Warwick, Hunter (OGN-159) — "I enter ready. When I attack, kill all damaged enemy units here."
 *
 * "I enter ready" replaces entering exhausted (369.3, EX[134]). The attack trigger (383.4.e)
 * kills every enemy unit at Warwick's location with damage marked on it (418) when it resolves.
 */
import { HERE, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Warwick, Hunter",
  text: "I enter ready.\nWhen I attack, kill all damaged enemy units here.",
  status: "implemented",
  abilities: [
    { kind: "passive", modifier: { kind: "enter-ready", target: SELF } },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "attack", subject: SELF } },
      effect: {
        op: "kill",
        target: {
          cardType: "unit",
          controller: "opponent",
          zone: HERE,
          where: {
            kind: "compare",
            left: { kind: "damage", selector: { targetRef: "it" } },
            op: "gt",
            right: 0,
          },
        },
      },
    },
  ],
});
