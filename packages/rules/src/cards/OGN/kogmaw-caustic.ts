/**
 * Kog'Maw, Caustic (OGN-190) — "[Deathknell] - Deal 4 to all units at my battlefield."
 * 808.1.c: "When I die, …"; 808.1.d.3: the location noted when it died is the kill event's zone.
 * Dying at a base deals nothing (it was not at a battlefield).
 */
import { registerCardScript, WHEN_I_DIE } from "../sdk";

registerCardScript({
  name: "Kog'Maw, Caustic",
  text: "[Deathknell] - Deal 4 to all units at my battlefield. (When I die, get the effect)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: {
        op: "if",
        condition: { kind: "event-zone-is", battlefield: true },
        then: {
          op: "deal",
          amount: 4,
          target: { cardType: "unit", zone: { kind: "chosen", ref: "event-zone" } },
        },
      },
    },
  ],
});
