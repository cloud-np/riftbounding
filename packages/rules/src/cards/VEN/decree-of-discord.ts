/** Decree of Discord. */
import { aUnit, custom, registerCardScript } from "../sdk";

const ORDER_UNIT = aUnit({
  controller: "opponent",
  targetRef: "target:0",
  anyNumber: true,
  group: { totalMight: { op: "lte", value: 5 } },
  where: custom("ven:has-domain", { domain: "order" }),
});

registerCardScript({
  name: "Decree of Discord",
  text: "Return any number of enemy Order ([Order]) units with total Might 5 or less to their owners' hands.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          // The zero-damage bind collects the group target on play (355.11.a); the second
          // instruction acts on the bound choice.
          { op: "deal", amount: 0, target: ORDER_UNIT },
          { op: "return_to_hand", target: { targetRef: "target:0" } },
        ],
      },
    },
  ],
});
