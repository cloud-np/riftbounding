/**
 * Call to Glory (OGN-207) — "[REACTION] As you play this, you may spend a buff as an additional
 * cost. If you do, ignore this spell's cost. Give a unit +3 [Might] this turn."
 * The spell effect is automated (479.4). The optional additional cost is parsed by R2-play from
 * the printed text, but "spend a buff" is not a supported cost (unpayable, 203.3) and "ignore
 * this spell's cost" has no cost-adjustment hook.
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Call to Glory",
  text: "[REACTION] (Play any time, even before spells and abilities resolve.)\nAs you play this, you may spend a buff as an additional cost. If you do, ignore this spell's cost.\nGive a unit +3 [Might] this turn.",
  status: "partial",
  notes:
    'Not automated: the optional additional cost "spend a buff" and "if you do, ignore this spell\'s cost" (204.2/356.2: Cost has no spend-buff component; costAdjustments cannot read the paid optional cost).',
  abilities: [{ kind: "spell", effect: { op: "temporary_might", amount: 3, target: aUnit() } }],
});
