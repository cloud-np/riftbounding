/**
 * Unleashed (UNL) R4 battlefields.
 *
 * Altar of Blood (UNL-206): "If a unit here would die during combat, its controller may pay
 * [Rune][Rune][Rune] to heal it, exhaust it, and recall it instead." R3-engine added optional
 * replacements with a cost (371.2) and ordering (372/373); R4-engine-e gives the ability's named
 * player its choice (190.6.c / 371.2.a): the battlefield's replacement belongs to its controller,
 * but the text names the dying unit's controller, who pays.
 */
import { registerCardScript } from "../registry";
import { HERE, custom } from "../dsl";

registerCardScript({
  name: "Altar of Blood",
  text: "If a unit here would die during combat, its controller may pay [rune] [rune] [rune] to heal it, exhaust it, and recall it instead.",
  status: "partial",
  notes:
    "The optional replacement is automated (371.2, 418). The apply/decline decision goes to the player the ability names (the dying unit's controller, 190.6.c / 371.2.a) and the payment is charged to them. Status stays with the Unleashed card lane.",
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
