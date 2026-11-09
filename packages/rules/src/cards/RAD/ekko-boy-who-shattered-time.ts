/** Ekko, Boy Who Shattered Time (RAD-139/168, legend) — Empower; disempower to discount the next unit. */
import { empower, registerCardScript, SELF, SELF_EMPOWERED } from "../sdk";

registerCardScript({
  name: "Ekko, Boy Who Shattered Time",
  text: '[Empower] — [1], [Tap] (Use only if not Empowered.)\nDisempower me, [Tap]: Reduce the cost of the next unit you play this turn by [2] [Rune] and give it "Kill me at end of turn."',
  status: "partial",
  notes:
    "Empower and the [2][Rune] next-unit discount are automated; 'disempower me' is modelled as a precondition paid on resolution (357.2 has no disempower Cost part), the discount is consumed by the next card of any type, and the granted kill-at-end trigger attaches to the next unit (not necessarily the discounted one).",
  abilities: [
    empower({ energy: 1 }),
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: {
        op: "requires",
        condition: SELF_EMPOWERED,
        rule: "357.2",
        effect: {
          op: "seq",
          effects: [
            { op: "disempower", target: SELF },
            {
              op: "continuous",
              duration: "this-turn",
              modifier: {
                kind: "cost-adjust",
                energy: -2,
                power: { any: -1 },
                target: { cardType: "unit", controller: "self" },
                once: true,
              },
            },
            {
              op: "delayed",
              trigger: { kind: "event", event: { type: "unit_played", player: "self" } },
              duration: "this-turn",
              once: true,
              effect: { op: "custom", id: "rad:delayed-kill-event" },
            },
          ],
        },
      },
    },
  ],
});
