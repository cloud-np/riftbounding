/**
 * Taric, Protector (OGN-074) — "[Shield] [Tank] Other friendly units here have [Shield]."
 *
 * His own [Shield]/[Tank] are printed (814/815). The keyword passive (801.3) grants [Shield] to the
 * other friendly units at his location; 814.2: Shield instances add up.
 */
import { registerCardScript } from "../registry";
import { HERE } from "../dsl";

registerCardScript({
  name: "Taric, Protector",
  text: "[Shield] (+1 [Might] while I'm a defender.)\n[Tank] (I must be assigned combat damage first.)\nOther friendly units here have [Shield].",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Shield",
        target: { cardType: "unit", controller: "self", zone: HERE, excludeSource: true },
      },
    },
  ],
});
