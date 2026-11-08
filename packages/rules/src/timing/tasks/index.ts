/**
 * Outstanding Tasks — rules 333/315–317.
 *
 * Tasks are handled before FEPR continues (334). Phase tasks run in the exact Start-of-Turn /
 * Ending-Phase order and each one advances the phase when complete. Handlers register
 * themselves at import time from `tasks/{phase,combat,play,custom}.ts`.
 *
 * Ownership after R1-PREP-E: `play.ts` = R2-play, `combat.ts` = R2-combat, `custom.ts` =
 * R2-effects (the `"custom"` kind is the effects/trigger escape hatch). This file is the frozen
 * import list.
 */
import "./phase";
import "./combat";
import "./play";
import "./custom";

export { queueTask, processNextTask } from "./phase";
export {
  EXPIRATION_INSERTS,
  MAX_EXPIRATION_PASSES,
  firstTurnChannelCount,
  runExpirationStep,
  skipsFirstDraw,
  startNextTurn,
} from "./phase";
export {
  getTaskHandler,
  registerTaskHandler,
  TASK_HANDLERS,
  taskHandlerKinds,
} from "./registry";
export type { TaskHandler, TaskHandlerContext, TaskResult } from "./registry";
