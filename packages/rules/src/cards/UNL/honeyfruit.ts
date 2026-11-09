/** Honeyfruit. */
import { registerCardScript, SELF, WHEN_PLAYED } from "../sdk";
import { ENTERS_EXHAUSTED_NOTE } from "./custom";

registerCardScript({
  name: "Honeyfruit",
  text: "This enters exhausted.\n[Reaction] [Tap]: [Add] [Rune]. (Abilities that add resources can't be reacted to.)\n[Level 6] [Reaction] [Tap]: [Add] [1][Rune]. (Use this ability only while you have 6+ XP.)",
  status: "partial",
  notes: ENTERS_EXHAUSTED_NOTE,
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    { kind: "suppress-printed-keyword", keyword: "Add" },
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "exhaust", target: SELF } },
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["reaction"],
      addsResources: true,
      effect: { op: "add", resources: { power: { any: 1 } } },
    },
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["reaction"],
      addsResources: true,
      effect: {
        op: "requires",
        condition: { kind: "xp-at-least", amount: 6 },
        rule: "824.1.b.1",
        effect: { op: "add", resources: { energy: 1, power: { any: 1 } } },
      },
    },
  ],
});
