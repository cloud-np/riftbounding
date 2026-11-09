/** Maduli the Gatekeeper. */
import { custom, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Maduli the Gatekeeper",
  text: "I can't be readied.\n[chaos] : Move me to an occupied enemy battlefield if my Might is greater than the total Might of enemy units there.",
  status: "implemented",
  abilities: [
    { kind: "passive", modifier: { kind: "restriction", restriction: "ready", target: SELF } },
    {
      kind: "activated",
      cost: { power: { Chaos: 1 } },
      effect: {
        op: "for_each",
        selector: {
          chosen: true,
          cardType: "battlefield",
          targetRef: "battlefield",
          where: custom("unl:enemy-battlefield-weaker"),
        },
        effect: { op: "move", target: SELF, to: { kind: "chosen", ref: "battlefield" } },
      },
    },
  ],
});
