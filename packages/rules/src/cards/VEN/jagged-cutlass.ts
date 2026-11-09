/** Jagged Cutlass. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Jagged Cutlass",
  text: "Equip [Body] ([Body]: Attach this to a unit you control.)\nI can't be moved by enemy spells and abilities.\n+2 [Might]",
  status: "partial",
  notes:
    "'Can't be moved by enemy spells and abilities' is not automated: `move` restrictions have no enemy-source qualifier and would also forbid the unit's own Standard Moves (421, 757).",
  abilities: [
    { kind: "passive", modifier: { kind: "might", amount: 2, target: { targetRef: "host" } } },
  ],
});
