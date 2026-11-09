/** Black Flame Altar. */
import { HERE, registerCardScript } from "../sdk";

registerCardScript({
  name: "Black Flame Altar",
  text: "Units here with [temporary] have [shield] . (+1 while they're defenders)",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Shield",
        target: { cardType: "unit", zone: HERE, keyword: "Temporary" },
      },
    },
  ],
});
