/** Energy Conduit (OGN-098) — "[Tap]: [Reaction] - [Add] [1]." (430.2 Add ability, 430.5) */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Energy Conduit",
  text: "[Tap]: [Reaction] - [Add] [1]. (Abilities that add resources can't be reacted to.)",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["reaction"],
      addsResources: true,
      effect: { op: "add", resources: { energy: 1 } },
    },
  ],
});
