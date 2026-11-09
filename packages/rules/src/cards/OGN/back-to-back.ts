/** Back to Back (OGN-206) — "Give two friendly units each +2 [Might] this turn." (355.7: two targets) */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Back to Back",
  text: "[REACTION] (Play any time, even before spells and abilities resolve.)\nGive two friendly units each +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: { op: "temporary_might", amount: 2, target: aUnit({ controller: "self", count: 2 }) },
    },
  ],
});
