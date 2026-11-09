/**
 * Fox-Fire — "Kill any number of units at a battlefield with total Might 4 or less" (355.13,
 * 355.11: the chosen group is at one location and its total Might is at most 4).
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Fox-Fire",
  text: "[HIDDEN] (Hide now for [Rune] to react with later for [0].) [ACTION] (Play on your turn or in showdowns.) Kill any number of units at a battlefield with total Might 4 or less.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "kill",
        target: aUnit({
          zone: "battlefield",
          anyNumber: true,
          group: { sameLocation: true, totalMight: { op: "lte", value: 4 } },
        }),
      },
    },
  ],
});
