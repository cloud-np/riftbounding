/**
 * Zenith Blade (OGN-262) — "[ACTION] Stun an enemy at a battlefield. You may move a friendly unit to
 * that enemy unit's battlefield."
 *
 * Both units are chosen when playing (355.7, 355.12: targets under "you may" too; the friendly unit
 * is "up to one"). The "may" is decided on resolution (383.3.a.3). Registers
 * `ogn:move-to-location-of`: moves `it` (421) to the current location of the object bound to
 * `of` — here the stunned enemy's battlefield.
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Zenith Blade",
  text: "[ACTION] (Play on your turn or in showdowns.)\nStun an enemy at a battlefield. You may move a friendly unit to that enemy unit's battlefield. (A stunned unit doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "stun",
            target: aUnit({ controller: "opponent", zone: "battlefield", targetRef: "target:0" }),
          },
          {
            op: "may",
            effect: {
              op: "for_each",
              selector: aUnit({ controller: "self", maxCount: 1, targetRef: "target:1" }),
              effect: {
                op: "custom",
                id: "ogn:move-to-location-of",
                params: { of: "target:0" },
              },
            },
          },
        ],
      },
    },
  ],
});
