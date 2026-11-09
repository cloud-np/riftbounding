/** Hwei, Brooding Painter. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Hwei, Brooding Painter",
  text: "When I move, draw 1, then discard 1. Then, do the following based on the discarded card's type:\n* Spell - Draw 1\n* Gear - Ready up to 2 runes\n* Unit - Give me +3 [Might] this turn",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "move", subject: SELF } },
      effect: {
        op: "seq",
        effects: [
          { op: "draw", amount: 1 },
          {
            op: "choose",
            key: "discarded",
            selector: { zone: "hand", controller: "self" },
            min: 1,
            max: 1,
            chooser: "self",
          },
          { op: "custom", id: "unl:discard-ref", params: { ref: "discarded" } },
          {
            op: "if",
            condition: { kind: "exists", selector: { targetRef: "discarded", cardType: "spell" } },
            then: { op: "draw", amount: 1 },
          },
          {
            op: "if",
            condition: { kind: "exists", selector: { targetRef: "discarded", cardType: "gear" } },
            then: {
              op: "seq",
              effects: [
                {
                  op: "choose",
                  key: "runes",
                  selector: { cardType: "rune", controller: "self", exhausted: true },
                  min: 0,
                  max: 2,
                  chooser: "self",
                },
                { op: "ready", target: { targetRef: "runes" } },
              ],
            },
          },
          {
            op: "if",
            condition: { kind: "exists", selector: { targetRef: "discarded", cardType: "unit" } },
            then: { op: "temporary_might", amount: 3, target: SELF },
          },
        ],
      },
    },
  ],
});
