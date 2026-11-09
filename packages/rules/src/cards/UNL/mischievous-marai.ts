/**
 * Mischievous Marai (UNL-003) — [Hidden] (811, engine keyword). "When you play me at a
 * battlefield" is part of the trigger condition (383.2.a.1); "here" is my battlefield (359.3.f).
 */
import { aUnit, HERE, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Mischievous Marai",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nWhen you play me at a battlefield, deal 2 to an enemy unit here.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: { kind: "event-zone-is", battlefield: true },
      effect: { op: "deal", amount: 2, target: aUnit({ controller: "opponent", zone: HERE }) },
    },
  ],
});
