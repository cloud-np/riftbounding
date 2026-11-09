/**
 * Seal of Strength (OGN-163) — "[Tap]: [REACTION] - [ADD] [Body]."
 *
 * An Add ability (430.2: finalizes and resolves immediately; 430.3: Reaction, usable while paying
 * costs). The catalog's [Reaction]/[Add] belong to the ability (135.2.e.7), not to the gear.
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Seal of Strength",
  text: "[Tap]: [REACTION] - [ADD] [Body]. (Abilities that add resources can't be reacted to.)",
  status: "implemented",
  abilities: [
    { kind: "keyword", keyword: "Reaction", value: 0 },
    { kind: "keyword", keyword: "Add", value: 0 },
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["reaction"],
      addsResources: true,
      effect: { op: "add", resources: { power: { Body: 1 } } },
    },
  ],
});
