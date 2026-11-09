/** Azir, Ascendant. */
import { aUnit, custom, registerCardScript, SELF } from "../sdk";
import { EQUIPMENT } from "./custom";

registerCardScript({
  name: "Azir, Ascendant",
  text: "[Calm]: [Action] — Choose a unit you control. Move me to its location and it to my original location. If it's equipped, you may attach one of its Equipment to me. Use only once per turn.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      keywords: ["action"],
      cost: { power: { Calm: 1 } },
      limit: { kind: "once-per-turn" },
      effect: {
        op: "seq",
        effects: [
          {
            op: "swap",
            a: SELF,
            b: aUnit({ controller: "self", targetRef: "target:0" }),
            property: "zone",
          },
          {
            op: "if",
            condition: {
              kind: "exists",
              selector: { ...EQUIPMENT, where: custom("sfd:it-attached-to", { ref: "target:0" }) },
            },
            then: {
              op: "may",
              label: "Attach one of its Equipment to me?",
              effect: {
                op: "attach",
                gear: {
                  ...EQUIPMENT,
                  pick: "controller",
                  where: custom("sfd:it-attached-to", { ref: "target:0" }),
                },
                to: SELF,
              },
            },
          },
        ],
      },
    },
  ],
});
