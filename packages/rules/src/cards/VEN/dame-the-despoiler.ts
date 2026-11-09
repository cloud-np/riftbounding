/** Dame the Despoiler. */
import { empower, HERE, registerCardScript, SELF, SELF_EMPOWERED } from "../sdk";

registerCardScript({
  name: "Dame the Despoiler",
  text: "[Empower][5][Body] ([5][Body]: Empower me. Use only if not Empowered.)\n[Empowered] When I attack or defend, choose a unit here. Increase my Might to its Might this turn, then give me +1 [Might] this turn.",
  status: "implemented",
  abilities: [
    empower({ energy: 5, power: { Body: 1 } }),
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: ["attack", "defend"], subject: SELF } },
      condition: SELF_EMPOWERED,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "unit",
            selector: { cardType: "unit", zone: HERE },
            min: 1,
            max: 1,
            label: "Choose a unit here",
          },
          { op: "custom", id: "ven:increase-might-to-chosen" },
        ],
      },
    },
  ],
});
