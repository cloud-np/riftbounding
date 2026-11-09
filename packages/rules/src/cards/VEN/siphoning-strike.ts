/**
 * Siphoning Strike (VEN-146) — "Deal 4 to a unit at a battlefield. If you control 7 or more
 * runes, deal 7 to it instead. When it dies this turn, channel 1 rune exhausted."
 *
 * The rune count is checked on resolution (359.3.f.2); the last sentence creates a delayed
 * triggered ability for the chosen unit (391.2, 359.3.f.3.a).
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";
import { runesControlled } from "./shared";

const TARGET = aUnit({ zone: "battlefield", targetRef: "target:0" });

registerCardScript({
  name: "Siphoning Strike",
  text: "Deal 4 to a unit at a battlefield. If you control 7 or more runes, deal 7 to it instead. When it dies this turn, channel 1 rune exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "if",
            condition: runesControlled("gte", 7),
            then: { op: "deal", amount: 7, target: TARGET },
            else: { op: "deal", amount: 4, target: TARGET },
          },
          {
            // Lethal damage kills in the next cleanup (323.4), after this delayed ability exists.
            op: "for_each",
            selector: { targetRef: "target:0" },
            effect: {
              op: "delayed",
              trigger: {
                kind: "event",
                event: { type: "die", subject: { targetRef: "target:0" } },
              },
              effect: { op: "channel", amount: 1, exhausted: true },
            },
          },
        ],
      },
    },
  ],
});
