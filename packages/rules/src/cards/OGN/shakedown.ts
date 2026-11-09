/**
 * Shakedown (OGN-033) — "[REACTION] Choose an enemy unit. Deal 6 to it unless its controller has you
 * draw 2."
 *
 * The enemy unit is the target (355.7). Registers `ogn-oz:unless-you-draw`: on resolution the
 * unit's controller decides (a decision made during resolution by another player, 355.18) whether
 * the spell's controller draws `draw`; otherwise `it` is dealt `amount` damage by the spell (418.6.a).
 */
import { aUnit, controllerOf, registerCardScript, registerCustomEffect, RESOLVED } from "../sdk";

function isYes(answer: unknown): boolean {
  if (answer === true || answer === "yes") return true;
  return Array.isArray(answer) && answer.includes("yes");
}

registerCustomEffect("ogn-oz:unless-you-draw", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const target = machine.env.it;
  if (!target) return RESOLVED;
  const amount = typeof params.amount === "number" ? params.amount : 0;
  const draw = typeof params.draw === "number" ? params.draw : 0;
  const answer = machine.frame.answer;
  if (answer === undefined) {
    const decider = controllerOf(context.room, context.step.host, target);
    if (!decider) return RESOLVED;
    return machine.ask({
      kind: "yes-no",
      playerId: decider,
      options: [
        { id: "yes", label: `Let them draw ${draw}` },
        { id: "no", label: `Take ${amount} damage` },
      ],
      min: 1,
      max: 1,
      rule: "355.18",
      promptKey: "rules.prompt.unlessDraw",
      data: { answer: "boolean" },
    });
  }
  machine.frame.answer = undefined;
  if (isYes(answer)) machine.push({ effect: { op: "draw", amount: draw } });
  else machine.push({ effect: { op: "deal", amount, target: { targetRef: "it" } } });
  return RESOLVED;
});

registerCardScript({
  name: "Shakedown",
  text: "[REACTION] (Play any time, even before spells and abilities resolve.)\nChoose an enemy unit. Deal 6 to it unless its controller has you draw 2.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aUnit({ controller: "opponent" }),
        effect: { op: "custom", id: "ogn-oz:unless-you-draw", params: { amount: 6, draw: 2 } },
      },
    },
  ],
});
