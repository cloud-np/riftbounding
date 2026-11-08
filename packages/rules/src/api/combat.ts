/** Combat-domain public surface — showdowns, combat 461–468, cleanups, scoring 469–474, victory. */
export { beginShowdown, endShowdown, passFocus } from "../timing/showdown";
export type { BeginShowdownOptions } from "../timing/showdown";
export {
  beginCombat,
  combatParticipants,
  combatTriggerOrder,
  designateCombatants,
  clearCombatDesignations,
  // 807 / 814 / 815 / 826 / 424.1.b
  combatKeywordProfile,
  combatMight,
  combatMightBonus,
  combatContribution,
  dealsCombatDamage,
  registerCombatContributionFilter,
  // 467.2.c
  lethalAssignment,
  assignmentTier,
  damageTargets,
  validateAssignment,
  enumerateAssignments,
  defaultAssignment,
  EXCLUSIVE_TIERS,
  // 467
  combatSideUnits,
  combatSideTotal,
  bothSidesRemain,
  assignmentDataFor,
  runAssignments,
  dealAssignedDamage,
  runCombatDamage,
  // 468
  COMBAT_CLEANUP_INSERTS,
  runCombatCleanup,
  determineCombatResult,
  establishCombatControl,
  endCombat,
  runCombatResolution,
  continueCombat,
  combatBlocked,
} from "../combat";
export type {
  CombatContinue,
  CombatContributionFilter,
  CombatKeywordProfile,
  CombatParticipants,
  DamageAssignment,
  AssignmentVerdict,
} from "../combat";
export { damageAssignmentVerdict } from "../prompts/combat";
export { COMBAT_PROMPT_REASONS } from "../prompts/combat/reasons";
export {
  battlefieldController,
  controlsBattlefield,
  setBattlefieldController,
  loseControl,
} from "../actions/control";
export { checkVictory, holdBattlefields, scoreBattlefield } from "../scoring/score";
export type { ScoreKind, ScoreResult } from "../scoring/score";
export { areOpponents, isTeamMode, teamOf, teammatesOf } from "../scoring/teams";
