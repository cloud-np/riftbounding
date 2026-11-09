/**
 * Spoils of War (OGN-144) — "[Reaction] If an enemy unit has died this turn, this costs [2] less.
 * Draw 2."
 *
 * "Draw 2" is automated (414). Partial: the cost reduction needs to know whether an enemy unit died
 * this turn (a per-turn death history), which the rules state does not record.
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Spoils of War",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nIf an enemy unit has died this turn, this costs [2] less.\nDraw 2.",
  status: "partial",
  notes:
    "The conditional [2] discount is manual: no per-turn history of units that died (429, 356.4).",
  abilities: [{ kind: "spell", effect: { op: "draw", amount: 2 } }],
});
