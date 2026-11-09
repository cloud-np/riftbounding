/** Jaull-Fish. */
import { registerCardScript } from "../sdk";
import { stepDiscounts } from "./custom";

registerCardScript({
  name: "Jaull-Fish",
  text: "[ACCELERATE] (You may pay [1] [Body] as an additional cost to have me enter ready.)\nI cost [2] less for each of your [MIGHTY] units. (A unit is Mighty while it has 5+ [Might].)",
  status: "implemented",
  // Four steps of [2] already exceed its [7] (the total cost is floored at 0, 356).
  abilities: stepDiscounts(
    (k) => ({
      kind: "count",
      selector: { cardType: "unit", controller: "self", mighty: true },
      comparison: { op: "gte", value: k },
    }),
    2,
    4,
  ),
});
