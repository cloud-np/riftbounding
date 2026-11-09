/** For Demacia! (RAD-117) — "Choose a battlefield. Give friendly units there [Shield 2] this turn." */
import { registerCardScript } from "../sdk";
import { aBattlefield, zoneRef } from "./custom";

registerCardScript({
  name: "For Demacia!",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose a battlefield. Give friendly units there [shield 2] this turn. (+2 [might] while they're defenders.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aBattlefield("battlefield"),
        effect: {
          op: "grant_keyword",
          keyword: "Shield",
          value: 2,
          target: { cardType: "unit", controller: "self", zone: zoneRef("battlefield") },
          duration: "this-turn",
        },
      },
    },
  ],
});
