/**
 * Sanction (VEN-035) — "[Reaction] Choose one — • Empower a unit. Disempower it at end of turn.
 * • Disempower a unit that's [Empowered]. Empower it at end of turn."
 *
 * 355.3 modes; "at end of turn" creates a delayed triggered ability for this turn's end (391.2,
 * 359.3.f.3.a: it refers to the unit chosen when it was created).
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Sanction",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose one — \n- Empower a unit. Disempower it at end of turn.\n- Disempower a unit that's [Empowered]. Empower it at end of turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "empower",
            label: "Empower a unit. Disempower it at end of turn.",
            effect: {
              op: "seq",
              effects: [
                { op: "empower", target: aUnit({ targetRef: "target:0" }) },
                {
                  op: "for_each",
                  selector: { targetRef: "target:0" },
                  effect: {
                    op: "delayed",
                    trigger: { kind: "turn-end" },
                    effect: { op: "disempower", target: { targetRef: "target:0" } },
                  },
                },
              ],
            },
          },
          {
            id: "disempower",
            label: "Disempower a unit that's Empowered. Empower it at end of turn.",
            effect: {
              op: "seq",
              effects: [
                { op: "disempower", target: aUnit({ targetRef: "target:1", empowered: true }) },
                {
                  op: "for_each",
                  selector: { targetRef: "target:1" },
                  effect: {
                    op: "delayed",
                    trigger: { kind: "turn-end" },
                    effect: { op: "empower", target: { targetRef: "target:1" } },
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
});
