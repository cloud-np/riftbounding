/**
 * Effect op barrel — importing it registers every built-in op handler (§6.2, 412–446).
 *
 * Control ops live in `control.ts`/`seq.ts`; each game action has its own module (paired inverse
 * actions share one: buff/spend_buff, empower/disempower, attach/detach, grant/remove keyword,
 * gain/spend XP, look/search/shuffle, add/spend counter).
 */
import "./seq";
import "./control";
import "./add";
import "./attach";
import "./banish";
import "./buff";
import "./burn-out";
import "./burn";
import "./channel";
import "./choose";
import "./cost-then";
import "./counter";
import "./counters";
import "./create";
import "./deal";
import "./delayed";
import "./discard";
import "./double";
import "./draw";
import "./empower";
import "./exhaust";
import "./heal";
import "./keyword";
import "./kill";
import "./look";
import "./mark";
import "./might";
import "./move";
import "./pay";
import "./play";
import "./predict";
import "./prevent";
import "./ready";
import "./recall";
import "./recycle";
import "./reflexive";
import "./return-to-hand";
import "./reveal";
import "./score-points";
import "./skip";
import "./stun";
import "./swap";
import "./xp";

export { EFFECT_OPS, getEffectOp, registerEffectOp, registeredEffectOps } from "../registry";
export type { EffectOp, OpHandler } from "../registry";
export { registerCustomEffect, customEffectIds } from "./control";
export type { CustomEffectHandler } from "./control";
