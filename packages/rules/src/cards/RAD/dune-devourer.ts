/**
 * Dune Devourer (RAD-125) — "You may kill a friendly unit as an additional cost to play me. If
 * you do, I cost [2] less. [Deflect]" The optional kill cost is registered; reading the paid
 * unit to reduce the cost is not expressible (356.2.b.1, 357.2).
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Dune Devourer",
  text: "You may kill a friendly unit as an additional cost to play me. If you do, I cost [2] less.\n[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)",
  status: "partial",
  notes:
    "The optional kill cost and [Deflect] are automated; the [2] discount for paying it is not (the cost layer cannot read an object paid as a cost, 356.2.b.1, 357.2).",
  additionalCosts: [
    {
      id: "optional:0",
      optional: true,
      cost: { kill: { cardType: "unit", controller: "self" } },
      rule: "356.2.b.1",
      label: "Kill a friendly unit",
    },
  ],
  abilities: [],
});
