/**
 * Armored Tusker (RAD-078) — "[Shield 3] [Tank] When I move, you may deal damage equal to my
 * [Shield] to a unit at a battlefield." (814.2: the summed Shield value, read on resolution)
 */
import { aUnit, registerCardScript, SELF, WHEN_I_MOVE } from "../sdk";
import { letX } from "./custom";

registerCardScript({
  name: "Armored Tusker",
  text: "[Shield 3] (+3 [Might] while I'm a defender.)\n[Tank] (I must be assigned combat damage first.)\nWhen I move, you may deal damage equal to my [Shield] to a unit at a battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      effect: {
        op: "may",
        effect: {
          op: "for_each",
          selector: aUnit({ zone: "battlefield" }),
          effect: letX(
            { keywordValue: "Shield", of: SELF },
            { op: "deal", amount: { kind: "x" }, target: { targetRef: "it" }, source: SELF },
          ),
        },
      },
    },
  ],
});
