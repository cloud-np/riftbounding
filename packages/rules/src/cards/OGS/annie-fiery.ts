/** Annie, Fiery (OGS-001 — EX[270]/EX[271] (715.2/715.3): Bonus Damage for spells and abilities.) */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Annie, Fiery",
  text: "Your spells and abilities deal 1 Bonus Damage. (Each instance of damage they deal is increased by 1.)",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "bonus-damage", amount: 1, from: "spells-and-abilities" },
    },
  ],
});
