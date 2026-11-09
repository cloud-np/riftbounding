/**
 * Resonating Strike (VEN-034, Vendetta errata) — "[Hidden] [Reaction] Choose a battlefield you
 * control and a unit you control at a different location. Move that unit to that battlefield and
 * give it +2 [Might] this turn."
 *
 * Both are chosen on play (355.7: the battlefield is a battlefield object, 053.3); the move is
 * an effect move (421). Hidden (811) is R2-play's keyword.
 */
import { registerCardScript } from "../registry";
import { aUnit, custom } from "../dsl";

registerCardScript({
  name: "Resonating Strike",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\n[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose a battlefield you control and a unit you control at a different location. Move that unit to that battlefield and give it +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: {
          chosen: true,
          cardType: "battlefield",
          controller: "self",
          targetRef: "target:0",
        },
        effect: {
          op: "seq",
          effects: [
            {
              op: "move",
              target: aUnit({
                controller: "self",
                targetRef: "target:1",
                where: custom("ven:not-at-ref-zone", { ref: "target:0" }),
              }),
              to: { kind: "chosen", ref: "target:0" },
            },
            { op: "temporary_might", amount: 2, target: { targetRef: "target:1" } },
          ],
        },
      },
    },
  ],
});
