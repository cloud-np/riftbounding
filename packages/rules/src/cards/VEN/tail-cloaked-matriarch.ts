/** Tail-Cloaked Matriarch. */
import { empower, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Tail-Cloaked Matriarch",
  text: "[Empower][2][Chaos] ([2][Chaos]: Empower me. Use only if not Empowered.)\nWhen I become [Empowered], you may choose a unit in your trash with Energy cost no more than [3] and Power cost no more than [Rune]. Play it to your base, ignoring its cost.",
  status: "implemented",
  abilities: [
    empower({ energy: 2, power: { Chaos: 1 } }),
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "empower", subject: SELF } },
      effect: {
        op: "may",
        label: "Play a unit from your trash?",
        effect: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "unit",
              selector: {
                cardType: "unit",
                zone: "trash",
                controller: "self",
                energyCost: { op: "lte", value: 3 },
                powerCost: { op: "lte", value: 1 },
              },
              min: 1,
              max: 1,
              label: "Choose a unit in your trash",
            },
            { op: "play", target: { targetRef: "unit" }, cost: "ignored", location: "base" },
          ],
        },
      },
    },
  ],
});
