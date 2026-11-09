/**
 * Overt Operation (OGN-153) — "[Action] For each friendly unit, you may spend its buff to ready it.
 * Then buff all friendly units."
 *
 * For each friendly unit that has a buff (702.2.b.1: only a buff can be spent), the player decides
 * on resolution (355.18) whether to spend it (a cost within the instruction, 740.4.a) to ready that
 * unit. Then every friendly unit is buffed (427.1.b: a unit with a buff gets no second one).
 */
import { registerCardScript } from "../registry";
import { custom } from "../dsl";

registerCardScript({
  name: "Overt Operation",
  text: "[Action] (play on your turn or in showdowns.)\nFor each friendly unit, you may spend its buff to ready it. Then buff all friendly units. (Each one that doesn't have a buff gets a +1 [might] buff.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "for_each",
            selector: { cardType: "unit", controller: "self", buffed: true },
            effect: {
              op: "may",
              label: "rules.prompt.spendBuffToReady",
              effect: {
                op: "seq",
                effects: [
                  { op: "spend_buff", target: { targetRef: "it" } },
                  {
                    op: "if",
                    condition: custom("did"),
                    then: { op: "ready", target: { targetRef: "it" } },
                  },
                ],
              },
            },
          },
          { op: "buff", target: { cardType: "unit", controller: "self" } },
        ],
      },
    },
  ],
});
