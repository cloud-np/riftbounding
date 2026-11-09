/** Fizz, Trickster. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Fizz, Trickster",
  text: "When you play me, you may play a spell from your trash with Energy cost no more than [3], ignoring its Energy cost. Then recycle it. (You must still pay its Power cost.)",
  status: "partial",
  notes:
    '"Then recycle it": a spell played from the trash goes back to the trash after it resolves; there is no hook that recycles a played card as it finishes resolving (417, 420.3, 401), so recycling it is left to the manual window.',
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "spell",
            selector: {
              cardType: "spell",
              zone: "trash",
              owner: "self",
              energyCost: { op: "lte", value: 3 },
            },
            min: 1,
            max: 1,
          },
          {
            op: "custom",
            id: "sfd:play-card",
            params: { target: { targetRef: "spell" }, energy: "ignore" },
          },
        ],
      },
    },
  ],
});
