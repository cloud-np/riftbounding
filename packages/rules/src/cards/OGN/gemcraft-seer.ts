/** Gemcraft Seer (OGN-100) — [Vision] (817); "Other friendly units have [VISION]." (365.1, 801.3) */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Gemcraft Seer",
  text: "[VISION] (When you play me, look at the top card of your Main Deck. You may recycle it.) \nOther friendly units have [VISION].",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Vision",
        target: { cardType: "unit", controller: "self", excludeSource: true },
      },
    },
  ],
});
