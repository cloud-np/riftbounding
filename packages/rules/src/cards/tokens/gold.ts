/**
 * Gold gear token (187.5) — "[Reaction][>] Kill this, [Tap]: [Add] [Rune]."
 *
 * An Add ability (430.2: finalizes and resolves immediately; 430.3: Reaction-tagged, usable
 * while paying costs). Its cost (kill this, exhaust this) is paid by R2-play's activation flow.
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Gold",
  text: "[Reaction][>] Kill this, [Tap]: [Add] [Rune].",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { kill: SELF, exhaust: SELF },
      keywords: ["reaction"],
      addsResources: true,
      effect: { op: "add", resources: { power: { any: 1 } } },
    },
  ],
});
