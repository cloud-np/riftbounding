/**
 * Production hook registrations for the effects layer (import-time, no game state).
 *
 * - `finalize:afterFinalize` (337.1): 403 for triggered items + the 359.3.e target snapshot;
 * - `advance:beforeTasks` (303.2.a / 334.1): turn-structure triggers, then detect + flush event
 *   triggers before Outstanding Tasks and FEPR;
 * - `cleanup:afterStep3a` (324.1): expire per-object "this turn"/"this combat" layer entries at
 *   the Expiration Step (317.2.c) and detect + flush triggers of the cleanup's own events (kills,
 *   moves, resolutions) before step 9 can open a Showdown — a pending trigger keeps the state
 *   Closed (402.1), so the Showdown/Combat waits for the chain (323.11/323.12).
 */
import { registerAdvanceHook, registerCleanupHook, registerFinalizeHook } from "../timing/hooks";
import { pruneObjectMods } from "../layers/mods";
import { collectPhaseTriggers } from "./detect";
import { onItemFinalized } from "./finalize";
import { flushPendingTriggers } from "./index";

registerFinalizeHook((room, item, step) => onItemFinalized(room, item, step));

registerAdvanceHook("beforeTasks", (room, step) => {
  collectPhaseTriggers(room, step);
  flushPendingTriggers(room, step);
});

registerCleanupHook("afterStep3a", (room, step) => {
  const rules = room.rules;
  if (!rules) return;
  const endOfTurn = rules.turn.phase === "ending" && rules.turn.step === "expiration";
  pruneObjectMods(room, { endOfTurn });
  flushPendingTriggers(room, step);
});
