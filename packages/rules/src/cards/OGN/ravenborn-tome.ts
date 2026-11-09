/** Ravenborn Tome (OGN-032 (Origins errata) — EX[179] (392): a Delayed Passive Bonus Damage for the next spell.) */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Ravenborn Tome",
  text: "[TAP]: The next spell you play this turn deals 1 Bonus Damage.\n(Each instance of damage the spell deals is increased by\n1.)",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: {
        op: "continuous",
        duration: "this-turn",
        modifier: { kind: "custom", id: "bonus-damage", params: { amount: 1, from: "spells", nextSpell: true } },
      },
    },
  ],
});
