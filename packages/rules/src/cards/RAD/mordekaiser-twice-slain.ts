/**
 * Mordekaiser, Twice Slain (RAD-020) — "Once each turn, if I would die, you may kill a friendly
 * unit to heal me, exhaust me, and recall me instead." (367–375, 371.2 optional replacement.)
 */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Mordekaiser, Twice Slain",
  text: "[Accelerate] (You may pay [1] [Fury] as an additional cost to have me enter ready.)\n[Assault 3] (+3 [Might] while I'm an attacker.)\nOnce each turn, if I would die, you may kill a friendly unit to heal me, exhaust me, and recall me instead.",
  status: "implemented",
  abilities: [
    {
      kind: "replacement",
      matches: { type: "kill", subject: SELF },
      limit: { kind: "once-per-turn" },
      replace: {
        op: "cost_then",
        optional: true,
        cost: { kill: { cardType: "unit", controller: "self", excludeSource: true } },
        effect: {
          op: "seq",
          effects: [
            {
              op: "heal",
              amount: { kind: "damage", selector: { targetRef: "event" } },
              target: { targetRef: "event" },
            },
            { op: "exhaust", target: { targetRef: "event" } },
            { op: "recall", target: { targetRef: "event" } },
          ],
        },
      },
    },
  ],
});
