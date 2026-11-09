/** Baron Nashor. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Baron Nashor",
  text: "As you play me, add the Baron Pit battlefield token to the board if it's not there already. If you do, I enter there. (It has \"Units can move here from anywhere\".)\nI can't be chosen by enemy spells and abilities.\nOther friendly units have +2 [Might].",
  status: "partial",
  notes:
    "'As you play me, add the Baron Pit battlefield token' is not automated: battlefield tokens (and entering there) have no engine support (103, 186).",
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "restriction", restriction: "be-targeted:enemy", target: SELF },
    },
    {
      kind: "passive",
      modifier: {
        kind: "might",
        amount: 2,
        target: { cardType: "unit", controller: "self", excludeSource: true },
      },
    },
  ],
});
