/** Flash (OGS-011 — EX[95] (358.3.a): "Move up to 2 friendly units to base.") */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Flash",
  text: "[REACTION] (Play at any time, even before spells and abilities resolve.)\nMove up to 2 friendly units to base.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "move", target: aUnit({ controller: "self", maxCount: 2 }), to: "base" } }],
});
