/** Kharox. */
import { empower, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Kharox",
  text: "[Empower][6][Chaos][Chaos] ([6][Chaos][Chaos]: Empower me. Use only if not Empowered.)\nWhen I become [Empowered], choose an opponent. They [Burn 3]. Then you may do this: Choose a unit in their trash and play it, ignoring its cost.",
  status: "implemented",
  abilities: [
    empower({ energy: 6, power: { Chaos: 2 } }),
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "empower", subject: SELF } },
      effect: {
        op: "seq",
        effects: [
          // 355.7: choose an opponent when the trigger finalizes.
          { op: "draw", amount: 0, player: { kind: "chosen", ref: "opponent" } },
          { op: "burn", amount: 3, target: { controller: { kind: "chosen", ref: "opponent" } } },
          {
            op: "may",
            label: "Play a unit from their trash?",
            effect: {
              op: "seq",
              effects: [
                {
                  op: "choose",
                  key: "unit",
                  selector: {
                    cardType: "unit",
                    zone: "trash",
                    owner: { kind: "chosen", ref: "opponent" },
                  },
                  min: 1,
                  max: 1,
                  label: "Choose a unit in their trash",
                },
                { op: "play", target: { targetRef: "unit" }, cost: "ignored", location: "base" },
              ],
            },
          },
        ],
      },
    },
  ],
});
