/**
 * Caitlyn, Patrolling (OGN-068).
 *
 * "I must be assigned combat damage last." — Backline's functional text (826.3): the combat
 * keyword profile reads the printed sentence, so damage assignment (467.2.c.6) puts me last.
 * "[Tap]: Deal damage equal to my Might to a unit at a battlefield. Use this ability only while
 * I'm at a battlefield." — automated (377.2.b precondition via `requires`; the [Tap] cost is
 * paid by R2-play's activation flow).
 */
import { aUnit, registerCardScript, SELF, SELF_AT_BATTLEFIELD } from "../sdk";

registerCardScript({
  name: "Caitlyn, Patrolling",
  text: "I must be assigned combat damage last.\n[Tap]: Deal damage equal to my Might to a unit at a battlefield. Use this ability only while I'm at a battlefield.",
  status: "implemented",
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
