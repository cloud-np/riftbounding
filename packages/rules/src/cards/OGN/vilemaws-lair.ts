/**
 * Vilemaw's Lair (OGN-295, battlefield) — "Units can't move from here to base."
 *
 * Manual: `restrictionFor` only qualifies `be-targeted` restrictions; a `move` restriction ignores
 * the query's destination (`to`), so "can't move … to base" would forbid every move from here
 * (054.1). The intended modifier is written below (inert while manual).
 */
import { registerCardScript } from "../registry";
import { HERE } from "../dsl";

registerCardScript({
  name: "Vilemaw's Lair",
  text: "Units can't move from here to base.",
  status: "manual",
  notes:
    "Destination-qualified move restrictions are not supported: restrictionFor ignores the `to` of a move query (054.1, 421).",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "restriction",
        restriction: "move:to-base",
        target: { cardType: "unit", zone: HERE },
      },
    },
  ],
});
