/**
 * Spirit's Refuge (OGN-063) — "When you play this, buff a friendly unit. Friendly buffed units
 * have [DEFLECT] if they didn't already."
 *
 * The catalog lists [Deflect] for the gear itself; it is granted text, not intrinsic (727.1.b
 * convention `value: 0`). The keyword passive (801.3) skips units that already have Deflect
 * (printed or object-granted), so it never adds a second instance (809.2).
 */
import { registerCardScript } from "../registry";
import { WHEN_PLAYED, aUnit, not } from "../dsl";

registerCardScript({
  name: "Spirit's Refuge",
  text: "When you play this, buff a friendly unit. (If it doesn't have a buff, it gets a +1 [Might] buff.)\nFriendly buffed units have [DEFLECT] if they didn't already. (Opponents must pay [Rune] to choose those units with a spell or ability.)",
  status: "implemented",
  abilities: [
    { kind: "keyword", keyword: "Deflect", value: 0 },
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "buff", target: aUnit({ controller: "self" }) },
    },
    {
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Deflect",
        target: {
          cardType: "unit",
          controller: "self",
          buffed: true,
          where: not({ kind: "has-keyword", selector: { targetRef: "it" }, keyword: "Deflect" }),
        },
      },
    },
  ],
});
