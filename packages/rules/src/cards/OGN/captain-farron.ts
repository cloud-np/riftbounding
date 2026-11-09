/**
 * Captain Farron (OGN-015) — "Other friendly units here have [ASSAULT]." (365.1 passive, 801.3)
 * The catalog's Assault is the granted keyword (Farron has none of his own).
 */
import { registerCardScript } from "../registry";
import { HERE } from "../dsl";

registerCardScript({
  name: "Captain Farron",
  text: "Other friendly units here have [ASSAULT] (+1 [Might] while they're attackers.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Assault" },
    {
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Assault",
        target: { cardType: "unit", controller: "self", excludeSource: true, zone: HERE },
      },
    },
  ],
});
