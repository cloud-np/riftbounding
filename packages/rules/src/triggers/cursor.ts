/**
 * Per-intent event cursor for trigger detection (383.2.c: a trigger condition is evaluated after
 * the potentially inciting event has been processed).
 *
 * The cursor lives on the per-intent `RulesStepContext` object under a symbol key, so it is
 * neither game state nor a module-level global: a new intent starts a new step (and a new
 * events array) at 0. Symbol-keyed properties are not serialized.
 */
import type { GameEvent } from "@rift/protocol";
import type { RulesStepContext } from "../types";

const CURSOR = Symbol("effects.triggerCursor");

type WithCursor = RulesStepContext & { [CURSOR]?: number };

/** Events emitted since the last call for this step (and advance the cursor). */
export function takeNewEvents(step: RulesStepContext): GameEvent[] {
  const holder = step as WithCursor;
  const start = holder[CURSOR] ?? 0;
  const events = step.events.slice(start);
  holder[CURSOR] = step.events.length;
  return events;
}
