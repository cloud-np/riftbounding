/**
 * @rift/protocol — strict-rules core state types.
 *
 * The strict engine (`@rift/rules`) keeps only the facts `Room` does not already model here.
 * Board facts (which card lives in which zone, owner/controller, exhausted, chain display) stay
 * on `Room`; `RulesState` is projected onto the existing `Room` fields after every step so the
 * original board UI keeps rendering.
 *
 * The extensible types are composed from core + one hook file per wave-R2 owner
 * (`./domains/{play,combat,effects,int}.ts`):
 *
 *   ReasonCode / TaskKind / PromptKind / Effect = Core* | <Domain>*
 *   ObjectRulesState / RulesHistory / PromptAnswer / ChainItem / LegalIntents
 *   / RulesPlayIntent / RulesActivateIntent = Core* & <Domain>*Fields
 *
 * Rules references use the official Riftbound Core Rules, Last Updated 2026-10-09.
 */

import type { BattlefieldZone, CardInstance } from "../game-state";
import type { Condition, Modifier } from "./effects";
import type {
  PlayChainItemFields,
  PlayHistoryFields,
  PlayLegalIntentsFields,
  PlayObjectFields,
  PlayPromptAnswerFields,
  PlayPromptKind,
  PlayReasonCode,
  PlayTaskKind,
  PlayWhoKind,
  PlayWhoWindow,
} from "./domains/play";
import type {
  CombatChainItemFields,
  CombatHistoryFields,
  CombatLegalIntentsFields,
  CombatObjectFields,
  CombatPromptAnswerFields,
  CombatPromptKind,
  CombatReasonCode,
  CombatTaskKind,
  CombatWhoKind,
  CombatWhoWindow,
} from "./domains/combat";
import type {
  EffectsChainItemFields,
  EffectsHistoryFields,
  EffectsLegalIntentsFields,
  EffectsObjectFields,
  EffectsPromptAnswerFields,
  EffectsPromptKind,
  EffectsReasonCode,
  EffectsTaskKind,
  EffectsWhoKind,
  EffectsWhoWindow,
} from "./domains/effects";
import type {
  IntChainItemFields,
  IntHistoryFields,
  IntLegalIntentsFields,
  IntObjectFields,
  IntPromptAnswerFields,
  IntPromptKind,
  IntReasonCode,
  IntTaskKind,
  IntWhoKind,
  IntWhoWindow,
} from "./domains/int";

/** `Domain` is not part of the recon-derived game-state module; mirror the cards union here. */
export type RulesDomain = "Fury" | "Calm" | "Mind" | "Body" | "Chaos" | "Order" | "Unknown";

/** Per-room toggle. Absent = sandbox (the byte-for-byte faithful simulator). */
export type RulesMode = "sandbox" | "strict";

/** Stable aliases for later waves / rule text. */
export type PlayerId = string;
export type ObjectId = string;
export type BattlefieldId = BattlefieldZone;

/** 314–317. */
export type RulesPhase = "awaken" | "beginning" | "channel" | "draw" | "main" | "ending";
export type RulesStep = "beginning" | "scoring" | "ending" | "expiration";

/** 307–310, derived from the chain/showdown state, never stored. */
export type TurnState = "neutral_open" | "neutral_closed" | "showdown_open" | "showdown_closed";

/** Rule citations are dotted strings, e.g. "309.1.a". */
export type RuleRef = string;

/** §5 — generic rejection codes. Domain-specific codes live in the matching `domains/*` file. */
export type CoreReasonCode =
  | "not_your_priority"
  | "closed_state_requires_reaction"
  | "showdown_requires_action"
  | "not_your_turn"
  | "not_main_phase"
  | "chain_not_empty"
  | "prompt_pending"
  | "game_over"
  | "not_in_game"
  | "strict_mode_action"
  | "rules_require_strict"
  | "loop_guard"
  | "nothing_to_pass"
  | "no_pending_prompt"
  | "unknown_card"
  | "unknown_intent"
  | "illegal_action";

/** §5 — every rejection code. `@rift/i18n` owns the `rules.reason.<code>` strings. */
export type ReasonCode =
  CoreReasonCode | PlayReasonCode | CombatReasonCode | EffectsReasonCode | IntReasonCode;

export type Verdict =
  { ok: true } | { ok: false; code: ReasonCode; rule: RuleRef; detail?: string };

/* ---------------------------------------------------------------- tasks / prompts (333, 411.2) */

/** 333 outstanding-task kinds. R2 agents add theirs in `domains/*`; do not edit this union. */
export type CoreTaskKind =
  | "ready-all"
  | "hold"
  | "channel"
  | "draw"
  | "empty-pools"
  | "cleanup"
  | "ending"
  | "expiration"
  | "start-turn"
  | "custom";

export type TaskKind = CoreTaskKind | PlayTaskKind | CombatTaskKind | EffectsTaskKind | IntTaskKind;

/** An Outstanding Task (rule 333). Tasks are handled before FEPR continues (334). */
export interface Task {
  id: string;
  kind: TaskKind;
  playerId?: string;
  zone?: BattlefieldZone;
  /** Arbitrary task payload (remaining draws, combat step, cleanup depth, …). */
  data?: Record<string, unknown>;
}

/** 411.2 prompt kinds. R2 agents add theirs in `domains/*`; do not edit this union. */
export type CorePromptKind =
  | "choose-opponent"
  | "choose-player"
  | "choose-card"
  | "choose-target"
  | "choose-mode"
  | "choose-battlefield"
  | "choose-number"
  | "yes-no"
  | "order"
  | "manual";

export type PromptKind =
  CorePromptKind | PlayPromptKind | CombatPromptKind | EffectsPromptKind | IntPromptKind;

export interface PromptOption {
  id: string;
  label?: string;
  cardId?: string;
  objectId?: string;
  playerId?: string;
  zone?: string;
  value?: string | number;
  disabled?: boolean;
}

/**
 * Prompt payload. `reason` is the prompt-handler key (§6.4 / 411.2); every other key is
 * handler-specific data.
 */
export interface PromptData {
  reason?: string;
  [key: string]: unknown;
}

/** A Limited-Action choice (411.2). Priority is irrelevant while a prompt is pending (312.1.b.1). */
export interface Prompt {
  id: string;
  kind: PromptKind;
  playerId: string;
  /** i18n key or short English label for the UI. */
  promptKey?: string;
  rule?: RuleRef;
  sourceItemId?: string;
  options?: PromptOption[];
  min?: number;
  max?: number;
  data?: PromptData;
}

/** Answer payload accepted by `rules_choose`. R2 agents add fields in `domains/*`. */
export interface CorePromptAnswer {
  optionIds?: string[];
  cardIds?: string[];
  objectIds?: string[];
  playerId?: string;
  zone?: BattlefieldZone | string;
  number?: number;
  boolean?: boolean;
  order?: string[];
  value?: string | number | boolean;
}

export type PromptAnswer = CorePromptAnswer &
  PlayPromptAnswerFields &
  CombatPromptAnswerFields &
  EffectsPromptAnswerFields &
  IntPromptAnswerFields;

/* ---------------------------------------------------------------- chain (327–340) */

export type ChainItemKind = "card" | "activated" | "triggered" | "token";
export type ChainItemOrigin = "play" | "trigger" | "add";

export type ChoiceValue =
  string | number | boolean | null | string[] | number[] | { [key: string]: ChoiceValue };

/** Choices made while finalizing (355). Targets, modes, locations, X values, … */
export type ChoiceRecord = Record<string, ChoiceValue>;

export interface PaidCost {
  energy?: number;
  power?: Partial<Record<RulesDomain | "any", number>>;
  /** Card ids / object ids consumed by the cost. */
  exhausted?: string[];
  discarded?: string[];
  killed?: string[];
  additional?: Record<string, ChoiceValue>;
}

/** Core of one Chain item. R2 agents add provenance/assignment fields in `domains/*`. */
export interface CoreChainItem {
  id: string;
  kind: ChainItemKind;
  status: "pending" | "finalized";
  controller: string;
  sourceObjectId?: string;
  cardName?: string;
  cardCode?: string;
  abilityRef?: string;
  choices: ChoiceRecord;
  paid?: PaidCost;
  /** 340.2.a / 346.1: focus does not pass for trigger/add items. */
  origin: ChainItemOrigin;
  /** Zone the card was played from (349–355). */
  fromZone?: string;
  /** Snapshot of the physical card while it is on the chain. */
  cardSnapshot?: CardInstance;
  addedAt?: number;
}

/** One item on the Chain. `rules.chain` is oldest first; display `Room.chainEntries` is newest first. */
export type ChainItem = CoreChainItem &
  PlayChainItemFields &
  CombatChainItemFields &
  EffectsChainItemFields &
  IntChainItemFields;

/* ---------------------------------------------------------------- triggers / effects (382, 475) */

export interface GameEvent {
  type: string;
  turn?: number;
  playerId?: string;
  controllerId?: string;
  objectId?: string;
  cardId?: string;
  sourceObjectId?: string;
  zone?: string;
  targetIds?: string[];
  amount?: number;
  cardName?: string;
  data?: Record<string, unknown>;
}

export interface PendingTrigger {
  id: string;
  controller: string;
  sourceObjectId?: string;
  sourceName?: string;
  abilityRef?: string;
  event?: GameEvent;
  /** 303.2.a order: turn order starting with the turn player. */
  order?: number;
  optional?: boolean;
  conditionMet?: boolean;
}

export type EffectDuration =
  | "this-turn"
  | "this-combat"
  | "while"
  | "until-next-ending"
  | "until-your-next-turn"
  | "permanent";

export interface ContinuousEffect {
  id: string;
  sourceObjectId?: string;
  controller: string;
  duration: EffectDuration;
  expiresAtTurn?: number;
  expiresAtPhase?: RulesPhase;
  condition?: Condition;
  modifier: Modifier;
  /** Optional human label for logs/debugging. */
  label?: string;
}

/* ---------------------------------------------------------------- objects / pools (165, 418) */

/** Core of the per-object rules state. R2 agents add fields in `domains/*`. */
export interface CoreObjectRulesState {
  /** 418: damage marked on a unit; lethal at might, killed in cleanup (323.4). */
  damage?: number;
  /** 427: buff counters (+1 might each). */
  buffs?: number;
  counters?: Record<string, number>;
  /** 424: stunned until the end-of-turn cleanup (424.1.a.2). */
  stunned?: boolean;
  /** 323.2: attacker/defender designation while a combat is in progress. */
  designation?: "attacker" | "defender";
  grantedKeywords?: string[];
  grantedAbilities?: string[];
  temporaryMight?: number;
  baseMight?: number;
  enteredThisTurn?: boolean;
  movedThisTurn?: boolean;
  attackedThisTurn?: boolean;
  damagedThisTurn?: boolean;
}

export type ObjectRulesState = CoreObjectRulesState &
  PlayObjectFields &
  CombatObjectFields &
  EffectsObjectFields &
  IntObjectFields;

export interface RunePool {
  energy: number;
  power: Partial<Record<RulesDomain | "any", number>>;
}

/** Core turn history. R2 agents add counters in `domains/*`. */
export interface CoreRulesHistory {
  /** Cards played this turn, per player (for card conditions). */
  cardsPlayedThisTurn: Record<string, number>;
  /** Units that entered the board this turn, per player. */
  unitsPlayedThisTurn?: Record<string, string[]>;
  /** 346.1: what opened the current chain ("trigger"/"add" suppress the focus pass). */
  chainOpenedBy?: ChainItemOrigin;
  /** Last prompt answers, for diagnostics / replay. */
  promptAnswers?: Array<{ promptId: string; playerId: string; answer: PromptAnswer }>;
}

export type RulesHistory = CoreRulesHistory &
  PlayHistoryFields &
  CombatHistoryFields &
  EffectsHistoryFields &
  IntHistoryFields;

/* ---------------------------------------------------------------- showdown / combat (341–348, 461–468) */

export interface ShowdownState {
  battlefield: BattlefieldZone;
  kind: "non_combat" | "combat";
  startedBy: string;
}

export interface CombatState {
  battlefield: BattlefieldZone;
  attacker: string;
  defender: string;
  /**
   * 461–468. `"damage-assignment"` (467.2.c) is additive: R1 only set showdown/damage/
   * resolution, no consumer switches exhaustively on this union (checked before widening).
   */
  step: "showdown" | "damage" | "damage-assignment" | "resolution";
}

export interface StagedState {
  showdowns: BattlefieldZone[];
  combats: BattlefieldZone[];
}

/** §6.4 — the manual-resolution fallback window. */
export interface ManualWindow {
  itemId: string;
  player: string;
  cardName: string;
}

export interface RulesState {
  version: 1;
  /** 304/314–317. */
  turn: {
    player: string;
    number: number;
    phase: RulesPhase;
    step?: RulesStep;
    /**
     * 317.2.f: FEPR episodes observed during the current Expiration Step that still owe a
     * restarted pass. Persisted so detection survives an intent boundary (a trigger may hand
     * out priority and resolve in a later intent). Cleared when the turn ends.
     */
    expirationFepr?: number;
    /** 317.2.f / 322: passes run in the current Expiration Step (bounded loop guard). */
    expirationPasses?: number;
  };
  /** 312: at most one player has priority (null when nobody may act). */
  priority: string | null;
  /** 313: showdown-only; null in a Neutral State (313.5). */
  focus: string | null;
  /** 339.1 priority passes / 347.2 focus passes, in sequence. */
  passes: string[];
  /** Oldest first. Ids match the `Room.chainEntries` display projection. */
  chain: ChainItem[];
  showdown: ShowdownState | null;
  combat: CombatState | null;
  /** Battlefield → player who applied Contested (190.3.a). */
  contested: Partial<Record<BattlefieldZone, string>>;
  staged: StagedState;
  /** Outstanding Tasks queue (333). */
  tasks: Task[];
  /** Pending Limited-Action choice (411.2). */
  prompt: Prompt | null;
  triggers: PendingTrigger[];
  effects: ContinuousEffect[];
  objects: Record<string, ObjectRulesState>;
  pools: Record<string, RunePool>;
  /** 472: once per battlefield per turn. */
  scoredThisTurn: Record<string, BattlefieldZone[]>;
  history: RulesHistory;
  manual: ManualWindow | null;
}

/* ---------------------------------------------------------------- read-side view (§3) */

/**
 * 312/313/347/411.2/§6.4 — who may act and in which window.
 *
 * `window` and `kind` are composed from the domain hooks (`domains/*`) exactly like
 * `ReasonCode`/`TaskKind`: today every domain member is `never`, so the unions are byte-for-byte
 * the R1 members. R2-combat may widen `CombatWhoWindow` to `"combat"` without core edits.
 */
export type CoreWhoWindow = "main" | "chain" | "showdown" | "prompt" | "manual";
export type WhoWindow = CoreWhoWindow | PlayWhoWindow | CombatWhoWindow | EffectsWhoWindow | IntWhoWindow;

export type CoreWhoKind = "priority" | "focus" | "prompt" | "manual" | "none";
export type WhoKind = CoreWhoKind | PlayWhoKind | CombatWhoKind | EffectsWhoKind | IntWhoKind;

export type WhoMayAct =
  | { kind: "priority"; player: string; window: WhoWindow }
  | { kind: "focus"; player: string; window: WhoWindow }
  | { kind: "prompt"; player: string; window: WhoWindow }
  | { kind: "manual"; player: string; window: WhoWindow }
  | { kind: "none" };

export interface LegalMove {
  unitIds: string[];
  to: BattlefieldZone | "base";
}

/** Core read-side intents. R2 agents add details in `domains/*`. */
export interface CoreLegalIntents {
  playerId: string;
  playableCardIds: string[];
  activatable: Array<{ objectId: string; ability: string }>;
  moves: LegalMove[];
  canPass: boolean;
  canEndTurn: boolean;
  canChoose: boolean;
  canManualDone: boolean;
  prompt: Prompt | null;
}

export type LegalIntents = CoreLegalIntents &
  PlayLegalIntentsFields &
  CombatLegalIntentsFields &
  EffectsLegalIntentsFields &
  IntLegalIntentsFields;
