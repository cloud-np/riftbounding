/**
 * Adaptatron (OGN-056) — "When I conquer, you may kill a gear. If you do, buff me."
 * 403.1 "you may"; 359.3.e.14.b "if you do" reads the kill.
 */
import { registerCardScript } from "../registry";
import { SELF, custom } from "../dsl";

registerCardScript({
  name: "Adaptatron",
  text: "When I conquer, you may kill a gear. If you do, buff me. (If I don't have a buff, I get a +1 [Might] buff.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "conquer", subject: SELF } },
      optional: true,
      effect: {
        op: "seq",
        effects: [
          { op: "kill", target: { chosen: true, cardType: "gear" } },
          { op: "if", condition: custom("did"), then: { op: "buff", target: SELF } },
        ],
      },
    },
  ],
});
