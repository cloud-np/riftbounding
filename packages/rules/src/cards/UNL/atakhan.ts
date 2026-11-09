/** Atakhan. */
import { HERE, registerCardScript, WHEN_I_ATTACK } from "../sdk";

registerCardScript({
  name: "Atakhan",
  text: "You may kill a friendly unit as an additional cost to play me. If you do, I cost [1] less for each Energy it costs and [order] less for each Power it costs.\n[ganking] (I can move from battlefield to battlefield.)\nWhen i attack, the defender must kill one of their units here.",
  status: "partial",
  notes:
    "The cost reduction for the killed unit's Energy and Power is not automated: the amount of a cost modifier cannot read the cost of an object paid as a cost (356.2.b.1, 357.2); only the optional kill cost and the attack trigger are.",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "victim",
            selector: { cardType: "unit", controller: "opponent", zone: HERE },
            min: 1,
            max: 1,
            chooser: "opponent",
          },
          { op: "kill", target: { targetRef: "victim" } },
        ],
      },
    },
  ],
});
