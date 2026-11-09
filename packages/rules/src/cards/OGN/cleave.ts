/**
 * Cleave (OGN-004) — "Give a unit [ASSAULT 3] this turn." (801.3.a; Assault 807.1.c)
 * The catalog's Assault is the granted keyword, not the spell's own (727.1.b-style suppression).
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Cleave",
  text: "[ACTION] (Play on your turn or in showdowns.)\n\nGive a unit [ASSAULT 3] this turn. (+3 [Might] while it's an attacker.)",
  status: "implemented",
  abilities: [
    { kind: "keyword", keyword: "Assault", value: 0 },
    {
      kind: "spell",
      effect: { op: "grant_keyword", keyword: "Assault 3", target: aUnit(), duration: "this-turn" },
    },
  ],
});
