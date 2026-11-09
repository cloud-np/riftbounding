/** Renekton, Butcher of the Sands. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Renekton, Butcher of the Sands",
  text: "[Reaction] [Rune][Rune], [Tap]: [Add] [2]. Spend this Energy only to play units or activated abilities of units.",
  status: "partial",
  notes:
    "'Spend this Energy only to play units or activated abilities of units' is a resource-spending restriction; added Energy carries no restriction (430.2).",
  abilities: [
    {
      kind: "activated",
      cost: { power: { any: 2 }, exhaust: SELF },
      keywords: ["reaction"],
      addsResources: true,
      effect: { op: "add", resources: { energy: 2 } },
    },
  ],
});
