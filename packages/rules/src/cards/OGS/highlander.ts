/**
 * Highlander (OGS-020, Origins errata) — "[Reaction] Choose a friendly unit. The next time it dies
 * this turn, heal it, exhaust it, and recall it instead."
 *
 * A delayed replacement effect (391.3, 369.1, used up once applied, 370.1.b) created for the
 * chosen unit (359.3.f.3.a); like Zhonya's Hourglass (EX[130]) the unit is healed, exhausted and
 * recalled (456, not a move).
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Highlander",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose a friendly unit. The next time it dies this turn, heal\nit, exhaust it, and recall it instead. (Send it to base. This\nisn't a move.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        // The chosen unit is validated on resolution (359.3.e), then the replacement is created
        // for it. 359.3.f.3.a / 391.3: the delayed matcher reads this ability's choices.
        op: "for_each",
        selector: aUnit({ controller: "self", targetRef: "target:0" }),
        effect: {
          op: "replace",
          matches: { type: "kill", subject: { targetRef: "target:0" } },
          replace: {
            op: "seq",
            effects: [
              { op: "heal", amount: 99, target: { targetRef: "event" } },
              { op: "exhaust", target: { targetRef: "event" } },
              { op: "recall", target: { targetRef: "event" } },
            ],
          },
        },
      },
    },
  ],
});
