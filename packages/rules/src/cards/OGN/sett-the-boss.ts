/**
 * Sett, The Boss (OGN-269, legend, Origins errata) — "If a buffed unit you control would die, you
 * may pay [Rune], exhaust me, and spend its buff to heal it, exhaust it, and recall it instead.
 * When you conquer, ready me."
 *
 * The first ability is an optional replacement (371.2) with costs (445): [Rune] plus exhausting
 * this legend. The buff is spent by the replacement's own instructions (702.2.b) because `Cost`
 * has no spend-a-buff component; the death is held until the "apply/decline" answer (R3-engine).
 * "When you conquer, ready me" is automated (383.4.c.2.b player-level conquer).
 */
import { registerCardScript } from "../registry";
import { EVENT_SUBJECT, SELF } from "../dsl";

registerCardScript({
  name: "Sett, The Boss",
  text: "If a buffed unit you control would die, you may pay [Rune], exhaust me, and spend its buff to heal it, exhaust it, and recall it instead. (Send it to base. This isn't a move.)\nWhen you conquer, ready me.",
  status: "implemented",
  abilities: [
    {
      kind: "replacement",
      matches: { type: "kill", subject: { cardType: "unit", controller: "self", buffed: true } },
      replace: {
        op: "cost_then",
        optional: true,
        cost: { power: { any: 1 }, exhaust: SELF },
        effect: {
          op: "seq",
          effects: [
            { op: "spend_buff", target: EVENT_SUBJECT },
            { op: "heal", amount: 99, target: EVENT_SUBJECT },
            { op: "exhaust", target: EVENT_SUBJECT },
            { op: "recall", target: EVENT_SUBJECT },
          ],
        },
      },
    },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "conquer", player: "self" } },
      effect: { op: "ready", target: SELF },
    },
  ],
});
