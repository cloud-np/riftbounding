/**
 * Fiora, Victorious (OGN-232) — "While I'm [Mighty], I have [Deflect], [Ganking] and [Shield]."
 * (708 Mighty = 5+ Might; 364.3.a conditional passive.) The catalog's keywords are the conditional
 * ones (and the "Mighty" description, 707), so they are not intrinsic.
 */
import type { Ability, KeywordName } from "@rift/protocol";
import { SELF_MIGHTY } from "../lib/conditions";
import { registerCardScript } from "../registry";
import { SELF, custom } from "../dsl";

const MIGHTY = SELF_MIGHTY;

function whileMighty(keyword: KeywordName): Ability {
  return {
    kind: "passive",
    modifier: { kind: "while", condition: MIGHTY, modifier: { kind: "keyword", keyword, target: SELF } },
  };
}

registerCardScript({
  name: "Fiora, Victorious",
  text: "While I'm [Mighty], I have [Deflect], [Ganking] and [Shield]. (I'm Mighty while I have 5+ [Might].)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Mighty" },
    { kind: "suppress-printed-keyword", keyword: "Deflect" },
    { kind: "suppress-printed-keyword", keyword: "Ganking" },
    { kind: "suppress-printed-keyword", keyword: "Shield" },
    whileMighty("Deflect"),
    whileMighty("Ganking"),
    whileMighty("Shield"),
  ],
});
