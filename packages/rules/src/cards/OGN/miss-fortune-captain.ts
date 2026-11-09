/**
 * Miss Fortune, Captain (OGN-162) — [Accelerate] [Ganking] (printed); "The first time I move each
 * turn, you may ready something else that's exhausted." (383.1.b read as a once-per-turn trigger,
 * cf. Wraith of Echoes; 403.1 "you may"; 416)
 *
 * The choice covers exhausted units and gear (the board locations); exhausted runes and legends
 * are in other zones and are not offered. A declined first trigger does not use up the limit.
 */
import { registerCardScript, WHEN_I_MOVE } from "../sdk";

registerCardScript({
  name: "Miss Fortune, Captain",
  text: "[ACCELERATE] (You may pay [1] [Body] as an additional cost to have me enter ready.)\n[GANKING] (I can move from battlefield to battlefield.)\nThe first time I move each turn, you may ready something else that's exhausted.",
  status: "partial",
  notes:
    '"Something else" offers exhausted units and gear only (a single choice cannot span the Rune Area and Legend Zone); declining the first trigger lets a later move trigger again (optional triggers count toward the limit only when accepted, 383.3.e).',
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      limit: { kind: "once-per-turn" },
      optional: true,
      effect: { op: "ready", target: { chosen: true, exhausted: true, excludeSource: true } },
    },
  ],
});
