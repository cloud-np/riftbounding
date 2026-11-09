/**
 * Windswept Hillock (OGN-297, battlefield) — "Units here have [GANKING]." (810; keyword passive,
 * 801.3)
 *
 * The keyword layer grants Ganking (`effectiveKeywords`) and R3-engine makes Standard Move
 * legality read keyword passives (810.3 / 144.4.c.1), so units here may move battlefield to
 * battlefield.
 */
import { HERE, registerCardScript } from "../sdk";

registerCardScript({
  name: "Windswept Hillock",
  text: "Units here have [GANKING]. (They can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "keyword", keyword: "Ganking", target: { cardType: "unit", zone: HERE } },
    },
  ],
});
