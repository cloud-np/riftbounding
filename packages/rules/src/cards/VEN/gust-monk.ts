/** Gust Monk. */
import { aUnit, notIntrinsic, PAID_ADDITIONAL, registerCardScript, WHEN_PLAYED } from "../sdk";

const PAID_FLAG_NOTE =
  "The optional additional cost is offered/paid by R2-play (`optional:0`) and the play effect reads the paid flag (356.4.f.1).";

registerCardScript({
  name: "Gust Monk",
  text: "You may pay [1] as an additional cost to play me.\nWhen you play me, if you paid the additional cost, banish a card from any trash to give a unit [Assault 2] this turn. (+2 [Might] while it's an attacker.)",
  status: "partial",
  notes: `"Banish a card from any trash to …" is a cost within the instruction: it is paid on resolution instead of when the trigger finalizes (cost_then has no banish-from-trash cost, 740.4.a.2). ${PAID_FLAG_NOTE}`,
  abilities: [
    ...notIntrinsic("Assault"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "banished",
            selector: { zone: "trash" },
            min: 1,
            max: 1,
            label: "Banish a card from any trash",
          },
          { op: "banish", target: { targetRef: "banished" } },
          {
            op: "if",
            condition: { kind: "did" },
            then: {
              op: "grant_keyword",
              keyword: "Assault",
              value: 2,
              target: aUnit({ targetRef: "target:0" }),
              duration: "this-turn",
            },
          },
        ],
      },
    },
  ],
});
