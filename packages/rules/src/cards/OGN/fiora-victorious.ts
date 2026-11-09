/**
 * Fiora, Victorious (OGN-232) — "While I'm [Mighty], I have [Deflect], [Ganking] and [Shield]."
 * (708 Mighty = 5+ Might; 364.3.a conditional passive.) The catalog's keywords are the conditional
 * ones (and the "Mighty" description, 707), so they are not intrinsic.
 */
import type { Ability } from "@rift/protocol";
import { registerCardScript } from "../registry";
import { SELF, custom } from "../dsl";

const MIGHTY = custom("self-mighty");

function whileMighty(keyword: string): Ability {
  return {
    kind: "passive",
    modifier: {
      kind: "custom",
      id: "conditional",
      params: { condition: MIGHTY, modifier: { kind: "keyword", keyword, target: SELF } },
    },
  };
}

registerCardScript({
  name: "Fiora, Victorious",
  text: "While I'm [Mighty], I have [Deflect], [Ganking] and [Shield]. (I'm Mighty while I have 5+ [Might].)",
  status: "implemented",
  abilities: [
    { kind: "keyword", keyword: "Mighty", value: 0 },
    { kind: "keyword", keyword: "Deflect", value: 0 },
    { kind: "keyword", keyword: "Ganking", value: 0 },
    { kind: "keyword", keyword: "Shield", value: 0 },
    whileMighty("Deflect"),
    whileMighty("Ganking"),
    whileMighty("Shield"),
  ],
});
