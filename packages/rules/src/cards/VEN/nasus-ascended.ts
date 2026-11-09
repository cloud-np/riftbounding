/**
 * Nasus, Ascended (VEN-046) — "[Deflect 2] [Empower][8] [Empowered] When I conquer, you score
 * 1 point."
 *
 * Deflect 2 is printed (809, R2-play); 827.1.c.1 Empower [8]; 828.1.c the Dependent conquer
 * trigger (383.4.c.2.a).
 */
import { SELF_EMPOWERED, WHEN_I_CONQUER, empower } from "./shared";
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Nasus, Ascended",
  text: "[Deflect 2] (Opponents must pay [Rune][Rune] to choose me with a spell or ability.)\n[Empower][8] ([8]: Empower me. Use only if not Empowered.)\n[Empowered] When I conquer, you score 1 point.",
  status: "implemented",
  abilities: [
    empower({ energy: 8 }),
    {
      kind: "triggered",
      trigger: WHEN_I_CONQUER,
      condition: SELF_EMPOWERED,
      effect: { op: "score_points", amount: 1 },
    },
  ],
});
