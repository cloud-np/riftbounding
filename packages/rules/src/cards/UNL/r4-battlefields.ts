/**
 * Unleashed (UNL) R4 battlefields.
 *
 * Altar of Blood (UNL-206): "If a unit here would die during combat, its controller may pay
 * [Rune][Rune][Rune] to heal it, exhaust it, and recall it instead." R3-engine added optional
 * replacements with a cost (371.2) and ordering (372/373); the replacement is scripted here.
 *
 * Known engine limitation: the optional decision is offered to the replacement source's
 * `controller`, which for a battlefield is the Turn Player (replacements/interceptor.ts
 * `replacementSources`), not the dying unit's controller. 190.6.a says the battlefield's
 * controller controls its abilities unless the ability indicates another player, and Altar of
 * Blood names the dying unit's controller (371.2.a). The payment itself uses the dying unit's
 * controller (`cost_then.player`). See the skipped [BUG] reproduction.
 */
import { registerCardScript } from "../registry";
import { HERE, custom } from "../dsl";

registerCardScript({
  name: "Altar of Blood",
  text: "If a unit here would die during combat, its controller may pay [rune] [rune] [rune] to heal it, exhaust it, and recall it instead.",
  status: "partial",
  notes:
    "The optional replacement itself is automated (371.2, 418). The apply/decline decision is offered to the Turn Player instead of the dying unit's controller when they differ (372.1, [BUG] in bugs.test.ts); the payment is charged to the dying unit's controller.",
  abilities: [
    {
      kind: "replacement",
      matches: {
        type: "kill",
        subject: { cardType: "unit", zone: HERE },
        condition: custom("unl:in-combat"),
      },
      replace: {
        op: "cost_then",
        optional: true,
        player: { kind: "controller", of: { targetRef: "event" } },
        cost: { energy: 3 },
        effect: {
          op: "seq",
          effects: [
            { op: "heal", amount: 99, target: { targetRef: "event" } },
            { op: "exhaust", target: { targetRef: "event" } },
            { op: "recall", target: { targetRef: "event" } },
          ],
        },
      },
    },
  ],
});
