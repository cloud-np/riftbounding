/**
 * Mournful Spirit (RAD-100) — "[Deathknell] You may kill a unit or gear here." (808)
 *
 * 355.7 / 808.1.d.3: the unit or gear is a Target chosen when the trigger is finalized; "here"
 * reads the leaving source's last-known location from the trigger event (383.2.c.3.b). The "you
 * may" decision is the resolution prompt of the `may` op (383.3.a).
 */
import { registerCardScript, WHEN_I_DIE } from "../sdk";
import { UNIT_OR_GEAR } from "./custom";

registerCardScript({
  name: "Mournful Spirit",
  text: "[Deathknell] You may kill a unit or gear here. (When I die, get the effect.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: {
        op: "may",
        effect: {
          op: "kill",
          target: {
            chosen: true,
            targetRef: "target:0",
            zone: { kind: "chosen", ref: "here" },
            where: UNIT_OR_GEAR,
          },
        },
      },
    },
  ],
});
