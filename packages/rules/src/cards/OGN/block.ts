/**
 * Block (OGN-057) — "[HIDDEN] [ACTION] Give a unit [SHIELD 3] and [TANK] this turn." (801.3.a;
 * Shield 814, Tank 815). [Hidden] (811) is R2-play's keyword. The catalog's Shield/Tank are the
 * granted keywords, not the spell's own.
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Block",
  text: "[HIDDEN]  (Hide now for [Rune] to react with later for [0].)\n[ACTION] (Play on your turn or in showdowns.)\n\nGive a unit [SHIELD 3] and [TANK] this turn. (+3 [Might] while it's a defender. It must be assigned combat damage first.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Shield" },
    { kind: "suppress-printed-keyword", keyword: "Tank" },
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "grant_keyword",
            keyword: "Shield", value: 3,
            target: aUnit({ targetRef: "target:0" }),
            duration: "this-turn",
          },
          {
            op: "grant_keyword",
            keyword: "Tank",
            target: { targetRef: "target:0" },
            duration: "this-turn",
          },
        ],
      },
    },
  ],
});
