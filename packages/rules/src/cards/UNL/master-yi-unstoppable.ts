/** Master Yi, Unstoppable. */
import type { Ability, Condition } from "@rift/protocol";
import { not, registerCardScript, SELF, whilePassive, xpAtLeast } from "../sdk";

const level = xpAtLeast;

function costLess(condition: Condition, energy: number, calm: number): Ability {
  return whilePassive(condition, {
    kind: "cost-adjust",
    energy: -energy,
    power: { Calm: -calm },
    target: SELF,
  });
}

registerCardScript({
  name: "Master Yi, Unstoppable",
  text: "[Level 3] I cost [2] [calm] less. (While you have 3+ XP, get the effect.)\n[Level 6] I cost [4] [calm] [calm] less instead.\n[Level 11] I cost [6] [calm] [calm] [calm] less instead.\n[Level 16] I can't be chosen by enemy spells and abilities.",
  status: "implemented",
  abilities: [
    costLess({ kind: "and", conditions: [level(3), not(level(6))] }, 2, 1),
    costLess({ kind: "and", conditions: [level(6), not(level(11))] }, 4, 2),
    costLess(level(11), 6, 3),
    {
      kind: "passive",
      modifier: {
        kind: "while",
        condition: level(16),
        modifier: { kind: "restriction", restriction: "be-targeted:enemy", target: SELF },
      },
    },
  ],
});
