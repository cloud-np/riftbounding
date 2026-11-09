/**
 * Loyal Poro (UNL-156) — [Deathknell] (808): "If I didn't die alone, draw 1" (740.2.a). Checked on
 * resolution against the units still at the location it died at.
 */
import { custom, registerCardScript, WHEN_I_DIE } from "../sdk";

registerCardScript({
  name: "Loyal Poro",
  text: "[Deathknell] If I didn't die alone, draw 1. (When I die, get the effect. I wasn't alone if there were other friendly units here.)",
  status: "partial",
  notes:
    "Aloneness is read from the units still at that location on resolution; friendly units that died simultaneously with it (e.g. The Ruination) are not seen, because last-known information about other objects at the time of death is not kept (383.2.c.3.b, 740.2.a).",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: {
        op: "if",
        condition: custom("unl:died-not-alone"),
        then: { op: "draw", amount: 1 },
      },
    },
  ],
});
