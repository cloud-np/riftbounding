/**
 * Yasuo, Unforgiven (OGN-259, legend, Origins errata) — "[2], [Tap]: Move a friendly unit to or
 * from its base."
 *
 * Two modes (355.3): from a battlefield to its base, or from its base to a battlefield (the
 * destination is chosen on activation, 355.4). The destination offer includes the base; moving a
 * unit from its base to its base does nothing (355.4.a).
 */
import { aUnit, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Yasuo, Unforgiven",
  text: "[2], [Tap]: Move a friendly unit to or from its base.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { energy: 2, exhaust: SELF },
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "to-base",
            label: "Move a friendly unit at a battlefield to its base",
            effect: {
              op: "move",
              target: aUnit({ controller: "self", zone: "battlefield", targetRef: "target:0" }),
              to: "base",
            },
          },
          {
            id: "from-base",
            label: "Move a friendly unit from its base",
            effect: {
              op: "move",
              target: aUnit({ controller: "self", zone: "base", targetRef: "target:1" }),
              to: { kind: "chosen", ref: "destination" },
            },
          },
        ],
      },
    },
  ],
});
