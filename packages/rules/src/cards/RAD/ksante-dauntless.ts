/**
 * K'Sante, Dauntless (RAD-045) — "[Shield] When I attack or defend, double the [Shield] of a unit
 * you control here this turn." Doubling adds an instance equal to its current Shield value (433,
 * 814.2).
 */
import { aUnit, HERE, registerCardScript, WHEN_I_ATTACK_OR_DEFEND } from "../sdk";
import { letX } from "./custom";

registerCardScript({
  name: "K'Sante, Dauntless",
  text: "[Shield] (+1 [Might] while I'm a defender.)\nWhen I attack or defend, double the [Shield] of a unit you control here this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK_OR_DEFEND,
      effect: {
        op: "for_each",
        selector: aUnit({ controller: "self", zone: HERE }),
        effect: {
          op: "if",
          condition: { kind: "has-keyword", selector: { targetRef: "it" }, keyword: "Shield" },
          then: letX(
            { keywordValue: "Shield", of: { targetRef: "it" } },
            {
              op: "grant_keyword",
              keyword: "Shield",
              value: { kind: "x" },
              target: { targetRef: "it" },
              duration: "this-turn",
            },
          ),
        },
      },
    },
  ],
});
