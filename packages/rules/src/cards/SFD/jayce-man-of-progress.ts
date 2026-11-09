/** Jayce, Man of Progress. */
import { aUnit, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Jayce, Man of Progress",
  text: "When you play me, you may kill a friendly gear. If you do, you may play a gear with Energy cost no more than [7] from hand this turn, ignoring its Energy cost. (You must still pay its Power cost.)",
  status: "partial",
  notes:
    '"You may play a gear … from hand this turn": the permission is not kept for the rest of the turn (no turn-long play permission, 420.3); the gear is chosen and played immediately while the trigger resolves, with its Power cost paid (356.1.b.1).',
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: {
        op: "seq",
        effects: [
          {
            op: "kill",
            target: aUnit({ cardType: "gear", controller: "self", targetRef: "target:0" }),
          },
          {
            op: "if",
            condition: { kind: "did" },
            then: {
              op: "seq",
              effects: [
                {
                  op: "choose",
                  key: "gear",
                  selector: {
                    cardType: "gear",
                    zone: "hand",
                    owner: "self",
                    energyCost: { op: "lte", value: 7 },
                  },
                  min: 0,
                  max: 1,
                },
                {
                  op: "custom",
                  id: "sfd:play-card",
                  params: { target: { targetRef: "gear" }, energy: "ignore" },
                },
              ],
            },
          },
        ],
      },
    },
  ],
});
