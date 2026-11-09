/**
 * Caitlyn, Patrolling (OGN-068).
 *
 * "I must be assigned combat damage last." — a damage-assignment requirement (467.2.c),
 * exposed as the `assigned-last` modifier for R2-combat (stays manual until it reads it).
 * "[Tap]: Deal damage equal to my Might to a unit at a battlefield. Use this ability only while
 * I'm at a battlefield." — automated (377.2.b precondition via `requires`; the [Tap] cost is
 * paid by R2-play's activation flow).
 */
import { aUnit, registerCardScript, SELF, SELF_AT_BATTLEFIELD } from "../sdk";

registerCardScript({
  name: "Caitlyn, Patrolling",
  text: "I must be assigned combat damage last.\n[Tap]: Deal damage equal to my Might to a unit at a battlefield. Use this ability only while I'm at a battlefield.",
  status: "partial",
  notes:
    "Combat damage assignment order (467.2.c) is R2-combat's; it reads the `assigned-last` modifier.",
  abilities: [
    { kind: "passive", modifier: { kind: "assigned-last", target: SELF } },
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: {
        op: "requires",
        condition: SELF_AT_BATTLEFIELD,
        effect: {
          op: "deal",
          amount: { kind: "might", selector: SELF },
          target: aUnit({ zone: "battlefield" }),
          source: SELF,
        },
      },
    },
  ],
});
