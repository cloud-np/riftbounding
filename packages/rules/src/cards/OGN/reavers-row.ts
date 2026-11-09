/**
 * Reaver's Row (OGN-285, battlefield) — "When you defend here, you may move a friendly unit here to
 * base."
 *
 * 383.4.f: the defending player gains the Defender designation here (player-level `defend`
 * event); 403.1: the leading "you may" is decided when the trigger finalizes. The unit is chosen
 * as a target (355.7) among the defender's units at this battlefield and moved to its base (421).
 */
import { registerCardScript } from "../registry";
import { HERE, WHEN_YOU_DEFEND_HERE, aUnit } from "../dsl";

registerCardScript({
  name: "Reaver's Row",
  text: "When you defend here, you may move a friendly unit here to base.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_DEFEND_HERE,
      optional: true,
      effect: { op: "move", target: aUnit({ controller: "self", zone: HERE }), to: "base" },
    },
  ],
});
