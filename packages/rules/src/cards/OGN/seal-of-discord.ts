/**
 * Seal of Discord (OGN-204) — "[Tap]: [REACTION] - [ADD] [Chaos]."
 *
 * An Add ability (430.2: finalizes and resolves immediately; 430.3: Reaction, usable while paying
 * costs). The catalog's [Reaction]/[Add] belong to the ability (135.2.e.7), not to the gear.
 */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Seal of Discord",
  text: "[Tap]: [REACTION] - [ADD] [Chaos]. (Abilities that add resources can't be reacted to.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    { kind: "suppress-printed-keyword", keyword: "Add" },
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["reaction"],
      addsResources: true,
      effect: { op: "add", resources: { power: { Chaos: 1 } } },
    },
  ],
});
