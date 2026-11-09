/**
 * "When another friendly unit dies" units (383.2.c.3; the dying unit's last-known controller,
 * 383.2.c.3.b): Spectral Centaur (+2 [Might] this turn) and Vicious Snapjaws (gain 1 XP).
 */
import type { Trigger } from "@rift/protocol";
import { registerCardScript, SELF } from "../sdk";

const ANOTHER_FRIENDLY_UNIT_DIES: Trigger = {
  kind: "event",
  event: { type: "die", subject: { cardType: "unit", controller: "self", excludeSource: true } },
};

registerCardScript({
  name: "Spectral Centaur",
  text: "When another friendly unit dies, give me +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: ANOTHER_FRIENDLY_UNIT_DIES,
      effect: { op: "temporary_might", amount: 2, target: SELF },
    },
  ],
});

registerCardScript({
  name: "Vicious Snapjaws",
  text: "When another friendly unit dies, gain 1 XP.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: ANOTHER_FRIENDLY_UNIT_DIES,
      effect: { op: "gain_xp", amount: 1 },
    },
  ],
});
