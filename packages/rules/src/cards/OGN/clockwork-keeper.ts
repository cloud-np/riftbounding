/**
 * Clockwork Keeper (OGN-044, Origins errata) — "You may pay [Calm] as an additional cost to play
 * me. When you play me, if you paid the additional cost, draw 1." (EX[85], 356.4.f.1)
 *
 * 383.2.a.1: the "if" right after the trigger condition is part of the condition, so the play
 * effect only triggers when the cost was paid. The optional additional cost itself is chosen and
 * paid by R2-play (contract: `choices.additionalCost === true`, noted on the permanent when it
 * finalizes).
 */
import { registerCardScript } from "../registry";
import { PAID_ADDITIONAL, WHEN_PLAYED } from "../dsl";

registerCardScript({
  name: "Clockwork Keeper",
  text: "You may pay [Calm] as an additional cost to play me.\n\nWhen you play me, if you paid the additional cost, draw 1.",
  status: "partial",
  notes: "The optional additional cost [Calm] is offered and paid by R2-play (355.1.a/357).",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, condition: PAID_ADDITIONAL, effect: { op: "draw", amount: 1 } },
  ],
});
