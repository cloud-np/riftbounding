/**
 * Meditation (OGN-048) — "[REACTION] As an additional cost to play this, you may exhaust a
 * friendly unit. If you do, draw 2. Otherwise, draw 1."
 *
 * The effect is written (356.4.f.1: "if you do" = the player decided to pay the optional
 * additional cost), but the card stays `manual`: the optional additional cost is chosen and paid
 * in R2-play's 355.1.a/357 flow, and the R1 golden/property/manual-window suites use Meditation
 * as their canonical unscripted card. Flip to "implemented" once R2-play binds
 * `choices.additionalCost`.
 */
import { registerCardScript } from "../registry";
import { PAID_ADDITIONAL } from "../dsl";

registerCardScript({
  name: "Meditation",
  text:
    "[REACTION] As an additional cost to play this, you may exhaust a friendly unit. If you do, draw 2. Otherwise, draw 1.",
  status: "manual",
  notes: "Optional additional cost (exhaust a friendly unit) is R2-play's; kept manual for the R1 manual-window suites.",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "if",
        condition: PAID_ADDITIONAL,
        then: { op: "draw", amount: 2 },
        else: { op: "draw", amount: 1 },
      },
    },
  ],
});
