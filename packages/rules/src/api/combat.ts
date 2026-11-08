/** Combat-domain public surface — showdowns, combat 461–468 and scoring 469–474. */
export { beginShowdown, endShowdown, passFocus } from "../timing/showdown";
export type { BeginShowdownOptions } from "../timing/showdown";
export {
  beginCombat,
  designateCombatants,
  runCombatDamage,
  runCombatResolution,
} from "../combat";
export { checkVictory, holdBattlefields, scoreBattlefield } from "../scoring/score";
export type { ScoreKind, ScoreResult } from "../scoring/score";
