/**
 * Prompt registry barrel — importing this module registers every built-in reason handler
 * (432.2.c Burn Out, 323.11 staged Showdown, 323.12 staged Combat) exactly once.
 *
 * Wave-R2 agents extend the domain barrels under `play/`, `combat/` and `effects/`; those are
 * imported here once, so this file never changes after R1-PREP-E.
 */
import "./burn-out";
import "./stage-showdown";
import "./stage-combat";
import "./play";
import "./combat";
import "./effects";

export * from "./handlers";
export * from "./play/reasons";
export * from "./combat/reasons";
export * from "./effects/reasons";
