/** Angle Shot. */
import { custom, registerCardScript } from "../sdk";
import { EQUIPMENT, target } from "./custom";

registerCardScript({
  name: "Angle Shot",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose a unit and an Equipment with the same controller. Attach that Equipment to that unit or detach that Equipment from that unit. Draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "if",
            // Attached to that unit: the only change is to detach it (or leave it); otherwise
            // the only change is to attach it (detaching would do nothing, 436.1.a.1).
            condition: {
              kind: "exists",
              selector: {
                targetRef: "target:1",
                where: custom("sfd:it-attached-to", { ref: "target:0" }),
              },
            },
            then: {
              op: "may",
              label: "Detach that Equipment?",
              effect: { op: "detach", target: { targetRef: "target:1" } },
            },
            else: {
              op: "may",
              label: "Attach that Equipment?",
              effect: {
                op: "attach",
                gear: {
                  ...EQUIPMENT,
                  chosen: true,
                  targetRef: "target:1",
                  where: custom("sfd:same-controller-as", { ref: "target:0" }),
                },
                to: target({ targetRef: "target:0" }),
              },
            },
          },
          { op: "draw", amount: 1 },
        ],
      },
    },
  ],
});
