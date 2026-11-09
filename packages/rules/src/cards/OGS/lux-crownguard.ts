/**
 * Lux, Crownguard (OGS-014 / VEN-SP6) — "[Tap]: [Reaction] - [Add] [2]. Use only to play spells."
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Lux, Crownguard",
  text: "[Tap]: [Reaction] - [Add] [2]. Use only to play spells. (Abilities that add resources can't be reacted to.)",
  status: "partial",
  notes:
    "'Use only to play spells' is a resource-spending restriction; added Energy carries no restriction (430.2), the same gap as Kaisa, Daughter of the Void.",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["reaction"],
      addsResources: true,
      effect: { op: "add", resources: { energy: 2 } },
    },
  ],
});
