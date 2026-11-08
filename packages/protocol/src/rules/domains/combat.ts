/**
 * Strict-rules wire types owned by wave R2-combat.
 * Owned by wave R2-combat. Add your union members / optional fields here only.
 *
 * Combat 461–468: begin/designate, showdown, damage assignment (467.2.c), combat cleanup 468,
 * plus combat scoring/victory. `../core.ts` composes these hooks into the exported wire types.
 * Keep every added field optional so R1 consumers keep compiling.
 */

/** §5 — combat/showdown state guards (461–468). */
export type CombatReasonCode = "showdown_active" | "combat_active";

/** 333 outstanding-task kinds owned by the combat layer (combat damage/cleanup). */
export type CombatTaskKind = "combat";

/** 411.2 prompt kinds owned by the combat layer (467.2.c damage assignment). */
export type CombatPromptKind = "damage-assignment";

/** §6.2 Effect ops owned by the combat layer (composed into `Effect`). */
export type CombatEffectOp = never;

/** 418 object state added by the combat layer (damage/assignment flags, …). */
export interface CombatObjectFields {}

/** `RulesHistory` counters owned by the combat layer (combats/damage per turn, …). */
export interface CombatHistoryFields {}

/** `PromptAnswer` fields used by combat prompts. */
export interface CombatPromptAnswerFields {
  /** 467.2.c: damage assignment, per target object id. */
  assignments?: Array<{ targetId: string; amount: number }>;
}

/** `ChainItem` extras owned by the combat layer (combat provenance, …). */
export interface CombatChainItemFields {}

/** `LegalIntents` extras owned by the combat layer (assignable damage, combat moves, …). */
export interface CombatLegalIntentsFields {}

/** `WhoMayAct.window` members owned by the combat layer (`"combat"` arrives with R2-combat). */
export type CombatWhoWindow = "combat";

/** `WhoMayAct.kind` members owned by the combat layer. */
export type CombatWhoKind = never;

/**
 * One assignable target of a combat damage assignment — rules 467.2.c, 467.2.c.2, c.3, c.4,
 * 467.2.c.4.a, c.5, c.7, c.8, c.9, c.10.
 *
 * Owner: R2-combat (types); consumed by the prompt UI and the property-test answerers.
 * Signature is a cross-agent contract: keep it stable.
 */
export interface CombatDamageTarget {
  objectId: string;
  /**
   * Damage that would be lethal now, after `previewDamage` (467.2.c.4 / 467.2.c.4.a).
   * `null` = cannot be dealt damage (467.2.c.10): exempt from mandatory assignment.
   */
  lethal: number | null;
  /**
   * Assignment priority group; every unit of a lower tier must be assigned lethal before any
   * higher tier (467.2.c.2, c.3, c.7). Convention: 0 = must be assigned first (e.g. Tank),
   * 1 = normal, 2 = last (e.g. Backline).
   */
  tier: number;
  /** Exclusionary assignment requirements the assigner must pick one of (467.2.c.8, c.9). */
  exclusiveChoices?: string[];
}

/**
 * Payload of a 467.2.c combat damage-assignment prompt.
 *
 * Prompt contract (467.2.c): `Prompt.kind = "damage-assignment"`, `playerId = assignerId`
 * (assignment starts with the Attacker), one option per target (`objectId`), `data` is this
 * object; the answer is `{ assignments: Array<{ targetId, amount }> }` summing to `total`.
 * When exactly one legal assignment exists, the engine assigns automatically and opens no prompt.
 *
 * Owner: R2-combat. Signature is a cross-agent contract: keep it stable.
 */
export interface CombatDamageAssignmentData {
  reason: "combat.damage_assignment";
  battlefield: string;
  /** 467.2.c: starting with the Attacker. */
  assignerId: string;
  /** The assigner's summed Might to assign. */
  total: number;
  targets: CombatDamageTarget[];
}
