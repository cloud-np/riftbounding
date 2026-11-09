/**
 * Super Mega Death Rocket! (OGN-252) — "Deal 5 to a unit. When you conquer, you may discard 1 to
 * return this from your trash to your hand."
 *
 * "Deal 5 to a unit" is automated (418). Partial: the second ability triggers while the card is in
 * its owner's trash (385, a non-board zone), and triggers of cards outside the board are not
 * detected.
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Super Mega Death Rocket!",
  text: "Deal 5 to a unit.\nWhen you conquer, you may discard 1 to return this from your trash to your hand.",
  status: "partial",
  notes:
    "The trash trigger ('When you conquer, you may discard 1 to return this') is manual: triggers of cards in non-board zones (385) are not detected.",
  abilities: [{ kind: "spell", effect: { op: "deal", amount: 5, target: aUnit() } }],
});
