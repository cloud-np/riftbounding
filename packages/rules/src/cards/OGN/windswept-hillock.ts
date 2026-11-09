/**
 * Windswept Hillock (OGN-297, battlefield) — "Units here have [GANKING]." (810; keyword passive,
 * 801.3)
 *
 * Partial: the keyword layer grants Ganking (`effectiveKeywords`), but the Standard Move legality
 * check reads keywords through the host-less array form, which ignores keyword passives, so a unit
 * here still cannot move battlefield to battlefield (810.3 violated; see the [BUG] test).
 */
import { registerCardScript } from "../registry";
import { HERE } from "../dsl";

registerCardScript({
  name: "Windswept Hillock",
  text: "Units here have [GANKING]. (They can move from battlefield to battlefield.)",
  status: "partial",
  notes:
    "Standard Move legality (legality/move.ts via play/keywords cardKeywords) ignores keyword passives, so the granted Ganking does not allow battlefield-to-battlefield moves (810.3).",
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "keyword", keyword: "Ganking", target: { cardType: "unit", zone: HERE } },
    },
  ],
});
