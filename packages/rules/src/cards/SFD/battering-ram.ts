/** Battering Ram. */
import { registerCardScript } from "../sdk";
import { stepDiscounts } from "./custom";

registerCardScript({
  name: "Battering Ram",
  text: "I cost [1] less for each card you've played this turn, to a minimum of [1].",
  status: "implemented",
  // 356.4.e: the minimum applies only to this discount — at most [4] off its [5] (356.4.g).
  abilities: stepDiscounts((k) => ({ kind: "cards-played", op: "gte", value: k }), 1, 4),
});
