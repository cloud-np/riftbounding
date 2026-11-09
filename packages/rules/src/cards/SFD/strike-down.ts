/** Strike Down. */
import { custom, registerCardScript } from "../sdk";
import { EQUIPMENT, target } from "./custom";

registerCardScript({
  name: "Strike Down",
  text: "Choose an equipped friendly unit. It deals damage equal to its Might to an enemy unit. Then detach an Equipment from it.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "deal",
            amount: { kind: "might", selector: { targetRef: "target:0" } },
            target: target({ controller: "opponent", targetRef: "target:1" }),
            // 418.6: the chosen unit is the damage source (its selector declares the Target, 355.7).
            source: target({
              controller: "self",
              targetRef: "target:0",
              where: custom("sfd:it-equipped"),
            }),
          },
          {
            op: "choose",
            key: "detached",
            selector: { ...EQUIPMENT, where: custom("sfd:it-attached-to", { ref: "target:0" }) },
            min: 1,
            max: 1,
          },
          { op: "detach", target: { targetRef: "detached" } },
        ],
      },
    },
  ],
});
