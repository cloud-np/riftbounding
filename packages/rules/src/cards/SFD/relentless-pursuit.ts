/** Relentless Pursuit. */
import { custom, registerCardScript } from "../sdk";
import { EQUIPMENT, target } from "./custom";

registerCardScript({
  name: "Relentless Pursuit",
  text: '[Action] (Play on your turn or in showdowns.)\nMove a friendly unit. You may attach up to one Equipment with the same controller to it. This turn, that unit has "When I conquer, you may move me to my base."',
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "move",
            target: target({ controller: "self", targetRef: "target:0" }),
            to: { kind: "chosen", ref: "destination" },
          },
          {
            op: "attach",
            gear: {
              ...EQUIPMENT,
              chosen: true,
              maxCount: 1,
              targetRef: "target:1",
              where: custom("sfd:same-controller-as", { ref: "target:0" }),
            },
            to: { targetRef: "target:0" },
          },
          // The granted triggered ability for this turn, as a delayed trigger bound to that unit (393).
          {
            op: "delayed",
            trigger: {
              kind: "event",
              event: {
                type: "conquer",
                condition: custom("sfd:ref-present-at-event", { ref: "target:0" }),
              },
            },
            optional: true,
            duration: "this-turn",
            effect: { op: "move", target: { targetRef: "target:0" }, to: "base" },
          },
        ],
      },
    },
  ],
});
