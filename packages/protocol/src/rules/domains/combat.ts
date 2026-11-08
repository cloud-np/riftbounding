/**
 * Strict-rules wire types owned by wave R2-combat.
 * Owned by wave R2-combat. Add your union members / optional fields here only.
 *
 * Combat 461–468: begin/designate, showdown, damage assignment (467.2.c), combat cleanup 468,
 * plus combat scoring/victory. `../core.ts` composes these hooks into the exported wire types.
 * Keep every added field optional so R1 consumers keep compiling.
 */

import type { BattlefieldZone } from "../../game-state";

/** §5 — combat/showdown state guards (461–468). */
export type CombatReasonCode = "showdown_active" | "combat_active";

/** 333 outstanding-task kinds owned by the combat layer (combat damage/cleanup). */
export type CombatTaskKind = "combat";

/** 411.2 prompt kinds owned by the combat layer (467.2.c damage assignment). */
export type CombatPromptKind = "damage-assignment";

/** §6.2 Effect ops owned by the combat layer (composed into `Effect`). */
export type CombatEffectOp = never;

/**
 * 418 object state added by the combat layer (damage/assignment flags, …).
 *
 * Two kinds of objects carry these fields:
 * - **Units** (keyed by card id): the 467.2.c assignment and the 383.4.e "first time this
 *   combat" designation flags.
 * - **Battlefields** (keyed by their zone id, e.g. `"battlefieldA"`; 170 / 199.1: a battlefield
 *   is a Game Object at its own location): `controller` (190).
 */
export interface CombatObjectFields {
  /**
   * 190.2 (battlefield objects only): the controlling player, or `null` when explicitly
   * Uncontrolled (468.5.b / 323.5). Absent = unknown (legacy/restored room): the engine falls back
   * to the 190.4.a presence proxy, excluding the Contested applier (190.3.a).
   */
  controller?: string | null;
  /** 467.2.c / 467.2.c.1: combat damage assigned (not yet dealt) to this unit. */
  assignedDamage?: number;
  /** 467.2.c / 142.3.a: the player who assigned `assignedDamage` (the damage's marker). */
  assignedBy?: string;
  /** 383.4.e.2.a: the unit already gained the Attacker designation during this combat. */
  attackedThisCombat?: boolean;
  /** 383.4.e.2.a (defend triggers): the unit already gained the Defender designation this combat. */
  defendedThisCombat?: boolean;
}

/** 466–468: where an ongoing combat is in its Steps of Combat (persisted across intents). */
export type CombatProgressStage =
  /** 467.1: decide whether combat damage is resolved at all. */
  | "damage"
  /** 467.2.c: assignment, starting with the Attacker (may wait for a prompt). */
  | "assign"
  /** 467.2.d: deal all assigned damage simultaneously. */
  | "deal"
  /** 468.1: the Combat Special Cleanup. */
  | "cleanup"
  /** 468.2 / 468.3: determine the combat result. */
  | "result"
  /** 468.4 / 468.5: establish control / conquer. */
  | "control"
  /** 468.6 / 468.7: combat ends. */
  | "end";

export interface CombatProgress {
  battlefield: BattlefieldZone;
  stage: CombatProgressStage;
  /** 467.2.c: players whose damage assignment is complete, in assignment order. */
  assigned?: string[];
  /** 467.2.a / 467.2.b: each side's summed Might when it assigned. */
  totals?: Record<string, number>;
  /**
   * 468.2 / 468.4 / 468.6: the next Task only becomes Outstanding once the chain items created by
   * the previous step have resolved. `true` while the engine waits for the chain to empty.
   */
  waiting?: boolean;
  /** 468.3.d: units were recalled during step 3d of the Combat Cleanup. */
  recalled?: boolean;
  /** 468.3: the combat result (`winner`/`loser` are null for "No Result"). */
  result?: { winner: string | null; loser: string | null; noResult: boolean };
}

/** 315.2 / 471.1.a / 491.8.b.1 / 491.8.g.1: battlefield facts at the Beginning Phase Scoring Step. */
export interface ScoringStepSnapshot {
  /** The Turn Player whose Scoring Step this was. */
  player: string;
  /** Battlefield → controller (null = uncontrolled) during the Scoring Step. */
  control: Partial<Record<BattlefieldZone, string | null>>;
  /** Battlefield → players with Units there (occupied, 170.11.a) during the Scoring Step. */
  occupiedBy: Partial<Record<BattlefieldZone, string[]>>;
}

/** `RulesHistory` counters owned by the combat layer (combats/damage per turn, …). */
export interface CombatHistoryFields {
  /** 466–468: progress of the combat in progress (cleared when the combat ends, 468.7). */
  combatProgress?: CombatProgress;
  /** 471.1.a / 491.8.b.1 / 491.8.g.1: snapshot taken at this turn's Scoring Step. */
  scoringSnapshot?: ScoringStepSnapshot;
}

/** `PromptAnswer` fields used by combat prompts. */
export interface CombatPromptAnswerFields {
  /** 467.2.c: damage assignment, per target object id. */
  assignments?: Array<{ targetId: string; amount: number }>;
  /**
   * 467.2.c.8 / 467.2.c.9 (optional): the exclusionary requirement chosen per unit, e.g.
   * `{ "<unit id>": "tank" }`. When omitted, the assignment is legal if any choice makes it legal.
   */
  exclusiveChoices?: Record<string, string>;
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
  /**
   * Exclusionary assignment requirements the assigner must pick one of (467.2.c.8, c.9).
   * Values: `"tank"` (tier 0) / `"backline"` (tier 2); when present, `tier` is the first choice.
   */
  exclusiveChoices?: string[];
  /** (optional, display) The unit's controller. */
  controllerId?: string;
  /** (optional, display) Damage already marked on the unit (467.2.c.4). */
  damage?: number;
  /** (optional, display) The unit's current Might including Assault/Shield (807 / 814). */
  might?: number;
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
  /** (optional) One legal assignment (467.2.c.3 greedy order) the UI may pre-fill. */
  suggested?: Array<{ targetId: string; amount: number }>;
}
