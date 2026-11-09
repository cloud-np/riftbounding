/**
 * Vayne, Hunter (OGN-035) — "[ASSAULT 3] If an opponent controls a battlefield, I enter ready. When
 * I conquer, you may pay [1] to return me to my owner's hand."
 *
 * [Assault 3] (807) is printed. "I enter ready" is a conditional entry replacement (369.3, 364.3.a)
 * — an opponent controls a battlefield (190; the engine's `controls` condition). "You may pay [1]
 * to return me" is an optional cost within the instruction (740.4.a), back to the owner's hand (056).
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Vayne, Hunter",
  text: "[ASSAULT 3] (+3 [Might] while I'm an attacker.)\nIf an opponent controls a battlefield, I enter ready.\nWhen I conquer, you may pay [1] to return me to my owner's hand.",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "while", condition: { kind: "controls", player: "opponent" }, modifier: { kind: "enter-ready", target: SELF } },
    },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "conquer", subject: SELF } },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "return_to_hand", target: SELF },
      },
    },
  ],
});
