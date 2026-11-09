/**
 * Kai'Sa, Daughter of the Void (OGN legend) — "[Tap]: [Reaction] - [Add] [Rune]. Use only to play
 * spells." (430.2 Add ability, 430.5)
 */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Kai'Sa, Daughter of the Void",
  text: "[Tap]: [Reaction] - [Add] [Rune]. Use only to play spells. (Abilities that add resources can't be reacted to.)",
  status: "partial",
  notes:
    'Not automated: "Use only to play spells" — resource spending restrictions by card type (no spend-restriction on added resources, 430.2).',
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["reaction"],
      addsResources: true,
      effect: { op: "add", resources: { power: { any: 1 } } },
    },
  ],
});
