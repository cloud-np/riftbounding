/**
 * Wallop (OGN-146) — "[Action] As you play this, you may spend a buff as an additional cost. If
 * you do, ignore this spell's cost. Ready a unit."
 *
 * "Ready a unit" is automated (416). Partial: the optional additional cost "spend a buff"
 * (356.2.b / 702.2.b) is not a payable cost in the play layer (an unsupported phrase is
 * unpayable, 203.3), so the "ignore this spell's cost" alternative is never available.
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Wallop",
  text: "[Action] (Play on your turn or in showdowns.)\nAs you play this, you may spend a buff as an additional cost. If you do, ignore this spell's cost. Ready a unit.",
  status: "partial",
  notes:
    "The optional additional cost (spend a buff, 702.2.b) and its cost-ignoring discount (356.2.b) are not payable by the play layer.",
  abilities: [{ kind: "spell", effect: { op: "ready", target: aUnit() } }],
});
