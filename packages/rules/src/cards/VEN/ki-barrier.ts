/** Ki Barrier (VEN-126) — "[Reaction] Choose a unit. Prevent the next 7 damage that would be dealt to it this turn." (438.1.b.1 shield) */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Ki Barrier",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose a unit. Prevent the next 7 damage that would be dealt to it this turn. (Opponents can assign it extra combat damage to kill it.)",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "prevent", amount: 7, target: aUnit() } }],
});
