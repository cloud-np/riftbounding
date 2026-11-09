/** Dragonsoul Sage (UNL-093) — "[Reaction] [Tap]: [Add] [1]." An Add ability (430.2/430.2.a: resolves immediately). */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Dragonsoul Sage",
  text: "[Reaction] [Tap]: [Add] [1]. (Abilities that add resources can't be reacted to.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["reaction"],
      addsResources: true,
      effect: { op: "add", resources: { energy: 1 } },
    },
  ],
});
