/**
 * Unleashed (UNL) R4 gear.
 *
 * Cursed Sarcophagus (UNL-148): "When you play this, banish all units from your trash.
 * [Tap]: Play a unit banished with this. (You must pay its costs.)" The play trigger is
 * automated; "[Tap]: Play a unit banished with this" is missing because the engine cannot
 * remember the objects banished by one card (428) nor grant a play permission for them.
 */
import { registerCardScript } from "../registry";
import { WHEN_PLAYED } from "../dsl";

registerCardScript({
  name: "Cursed Sarcophagus",
  text: "When you play this, banish all units from your trash.\n[Tap]: Play a unit banished with this. (You must pay its costs.)",
  status: "partial",
  notes:
    "The play trigger banishes every unit from your trash (428). '[Tap]: Play a unit banished with this' is missing: remembering objects banished 'with this' and playing them from Banishment for their costs is not implemented (428, 354).",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "banish",
        target: { cardType: "unit", zone: "trash", controller: "self" },
      },
    },
  ],
});
