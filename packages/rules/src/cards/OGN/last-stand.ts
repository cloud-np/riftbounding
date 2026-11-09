/** Last Stand (OGN-069 — EX[222] (433.1.a), EX[258] (479.4.c)) */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Last Stand",
  text: "[Action] (Play on your turn or in showdowns.)\nDouble a friendly unit's Might this turn. Give it [Temporary]. Kill it at the start of its controller's Beginning Phase, before scoring.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "double", target: aUnit({ controller: "self", targetRef: "target:0" }) },
          { op: "grant_keyword", keyword: "Temporary", target: { targetRef: "target:0" } },
        ],
      },
    },
  ],
});
