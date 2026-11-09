/** Guardian Angel. */
import { EVENT_SUBJECT, registerCardScript, SELF } from "../sdk";
import { mightBonus } from "./custom";

registerCardScript({
  name: "Guardian Angel",
  text: "[Equip][Calm]  ([Calm]: Attach this to a unit you control.)\n\nIf I would die, kill Guardian Angel instead. Heal me, Exhaust me, and recall me.\n+1 [Might]",
  status: "implemented",
  abilities: [
    // 369.1 / 718.3: an attached card's Effect Text replacement is appended to the host. "I"
    // is the Top-Most card (136.2.d); "Guardian Angel" is the attached card itself.
    {
      kind: "replacement",
      matches: { type: "kill", subject: { targetRef: "host" } },
      replace: {
        op: "seq",
        effects: [
          { op: "kill", target: SELF },
          { op: "heal", amount: 99, target: EVENT_SUBJECT },
          { op: "exhaust", target: EVENT_SUBJECT },
          { op: "recall", target: EVENT_SUBJECT },
        ],
      },
    },
    mightBonus(1),
  ],
});
