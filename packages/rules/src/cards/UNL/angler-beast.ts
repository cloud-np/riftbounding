/** Angler Beast (UNL-132) — Play Effect: return all units with 2 [Might] or less to their owners' hands (056, 355.5.a). */
import { registerCardScript } from "../registry";
import { WHEN_PLAYED } from "../dsl";

registerCardScript({
  name: "Angler Beast",
  text: "When you play me, return all units with 2 [Might] or less to their owners' hands.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "return_to_hand",
        target: { cardType: "unit", all: true, might: { op: "lte", value: 2 } },
      },
    },
  ],
});
