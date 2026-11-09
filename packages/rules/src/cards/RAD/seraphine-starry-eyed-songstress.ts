/** Seraphine, Starry-Eyed Songstress (RAD-151/174, legend) — four-object optional additional cost. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Seraphine, Starry-Eyed Songstress",
  text: "As an additional cost to play a spell, you may exhaust me and three friendly units to reduce the cost of that spell by [2].",
  status: "manual",
  notes:
    "An optional additional cost that exhausts the legend plus three units cannot be expressed (Cost.exhaust is one selector, and component discounts on optional costs are not modelled; 356.2.b.1, 356.4.c, 357.2).",
  abilities: [],
});
