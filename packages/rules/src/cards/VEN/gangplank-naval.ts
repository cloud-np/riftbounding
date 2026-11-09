/**
 * Gangplank's Empowered replacement: the stun branch is a game action (`stun`) and can be
 * replaced; "give me -[Might]" and "return me to hand" are not interceptable actions, and the
 * "spell or ability that chooses me" qualifier has no choice record on the event.
 */
import { empower, registerCardScript, SELF, SELF_EMPOWERED } from "../sdk";

registerCardScript({
  name: "Gangplank, Naval",
  text: "[Empower][C][C] ([C][C]: Empower me. Use only if not Empowered.)\n[Empowered] If a spell or ability that chooses me would stun me, give me -[Might], or return me to hand, give me +3 [Might] this turn instead.",
  status: "partial",
  notes:
    "Only the stun branch is automated: 'would stun me' is a replaceable action (424), but Might decreases are applied directly by the arithmetic layer and return-to-hand is not intercepted; the 'spell or ability that chooses me' qualifier is not recorded on those events.",
  abilities: [
    empower({ power: { any: 2 } }),
    {
      kind: "replacement",
      matches: { type: "stun", subject: SELF, condition: SELF_EMPOWERED },
      replace: { op: "temporary_might", amount: 3, target: SELF },
    },
  ],
});
