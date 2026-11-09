/** Lecturing Yordle (OGN-087) — [Tank] (R2-combat's keyword); "When you play me, draw 1." (383.4.a) */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Lecturing Yordle",
  text: "[Tank] (I must be assigned combat damage first.)\n\nWhen you play me, draw 1.",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "draw", amount: 1 } }],
});
