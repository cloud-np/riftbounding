/**
 * Covert Informant (VEN-057) — "[Empower][3] [Empowered] When I move, draw 1."
 *
 * 828.1.c: the Dependent triggered ability is active only while I'm Empowered (checked when the
 * move happens, 727.1.c.1).
 */
import { empower, registerCardScript, SELF_EMPOWERED, WHEN_I_MOVE } from "../sdk";

registerCardScript({
  name: "Covert Informant",
  text: "[empower][3] ([3]: Empower me. Use only if not Empowered.)\n[empowered] When I move, draw 1.",
  status: "implemented",
  abilities: [
    empower({ energy: 3 }),
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      condition: SELF_EMPOWERED,
      effect: { op: "draw", amount: 1 },
    },
  ],
});
