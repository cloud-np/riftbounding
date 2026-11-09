/**
 * Mordekaiser, Iron Revenant (RAD-143, legend) — [Reaction] Banish a unit or gear from your
 * trash, [Tap]: [Add][Rune]. The banish is modelled as a chosen instruction (a cost cannot name
 * a trash card, 357.2) and the Power-spending restriction is not modelled (430.5).
 */
import { custom, notIntrinsic, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Mordekaiser, Iron Revenant",
  text: "[Reaction] Banish a unit or gear from your trash, [Tap]: [Add][Rune]. Spend this Power only to play units or gear. (Abilities that add resources can't be reacted to.)",
  status: "partial",
  notes:
    "The banish is a resolution instruction (not a cost) and 'Spend this Power only to play units or gear' is not modelled: ResourceSpec has no spending restriction (357.2, 430.5).",
  abilities: [
    ...notIntrinsic("Add"),
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["reaction"],
      addsResources: true,
      effect: {
        op: "requires",
        condition: {
          kind: "exists",
          selector: { zone: "trash", controller: "self", where: custom("rad:unit-or-gear") },
        },
        rule: "377.2.b",
        effect: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "banished",
              selector: { zone: "trash", controller: "self", where: custom("rad:unit-or-gear") },
            },
            { op: "banish", target: { targetRef: "banished" } },
            { op: "add", resources: { power: { any: 1 } } },
          ],
        },
      },
    },
  ],
});
