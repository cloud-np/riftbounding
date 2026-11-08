/**
 * `skip` — rule 444 (a Replacement Effect: the skipped event or procedure is replaced with
 * nothing, 444.2; nothing triggers on it, 444.2.a).
 *
 * Creates a `{ kind: "custom", id: "skip", params: { what, phase?, player } }` effect lasting
 * until the controller's next turn ends; `replacements/interceptor.ts` consumes it the next time
 * that player's Draw Phase draw (`what: "draw"`) or Channel Phase channel (`what: "channel"`)
 * would happen. TODO(R2-effects): skipping a whole phase (`what: "phase"`) needs a phase hook.
 */
import { pushEvent } from "../../types";
import { addContinuousEffect } from "../../layers/mods";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome } from "../targets";
import { ctxOf, hostOf } from "./util";

registerEffectOp("skip", (effect, context) => {
  if (effect.op !== "skip") return { status: "manual", reason: "effect_not_implemented:skip" };
  if (effect.what === "phase") return { status: "manual", reason: "effect_not_implemented:skip_phase" };
  const ctx = ctxOf(context);
  const id = addContinuousEffect(context.room, hostOf(context), {
    controller: ctx.env.controller,
    duration: "permanent",
    modifier: {
      kind: "custom",
      id: "skip",
      params: { what: effect.what, player: ctx.env.controller, ...(effect.phase ? { phase: effect.phase } : {}) },
    },
    ...(ctx.env.sourceObjectId ? { sourceObjectId: ctx.env.sourceObjectId } : {}),
  });
  pushEvent(context.step.events, { type: "skip_created", playerId: ctx.env.controller, data: { what: effect.what, effectId: id } });
  recordOutcome(context, [], true);
  return RESOLVED;
});
