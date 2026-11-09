/** Dune Surfer. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Dune Surfer",
  text: "You ignore [Tank] while assigning combat damage here.",
  status: "partial",
  notes:
    "`ignore-keyword` (764–767) has no consumer in combat damage assignment yet; the Tank profile still applies while assigning damage here.",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "ignore-keyword",
        keyword: "Tank",
        action: "assign-combat-damage",
        here: true,
      },
    },
  ],
});
