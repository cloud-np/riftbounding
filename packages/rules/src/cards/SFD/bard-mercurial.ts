/** Bard, Mercurial. */
import { PAID_ADDITIONAL, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Bard, Mercurial",
  text: "You may exhaust your legend as an additional cost to play me. \n\nWhen you play me, if you paid the additional cost, move any number of your units to an open battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "movers",
            selector: { cardType: "unit", controller: "self" },
            min: 0,
            max: 99,
          },
          { op: "custom", id: "sfd:move-to-open-battlefield", params: { ref: "movers" } },
        ],
      },
    },
  ],
});
