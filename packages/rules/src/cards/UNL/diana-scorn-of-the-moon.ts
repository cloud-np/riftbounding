/** Diana, Scorn of the Moon. */
import { custom, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Diana, Scorn of the Moon",
  text: "[reaction] [tap]: [add] [1] . Spend this Energy only during showdowns. (Abilities that add recources can't be reacted to.)",
  status: "partial",
  notes:
    "'Spend this Energy only during showdowns' is approximated by only allowing the ability to be used during a showdown: the Energy then sits in the pool until it empties (054.1, 166).",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    { kind: "suppress-printed-keyword", keyword: "Add" },
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["reaction"],
      addsResources: true,
      effect: {
        op: "requires",
        condition: custom("unl:in-showdown"),
        rule: "340",
        effect: { op: "add", resources: { energy: 1 } },
      },
    },
  ],
});
