/**
 * Strict-rules wire types owned by wave R2-effects.
 * Owned by wave R2-effects. Add your union members / optional fields here only.
 *
 * Effect DSL interpreter (§6.2), game actions 412–448, triggers (382+, 303.2.a), replacements
 * (367–375) and layers (475–479). `../core.ts` / `../effects.ts` compose these hooks into the
 * exported wire types. Keep every added field optional so R1 consumers keep compiling.
 */
import type { ChoiceRecord, ChoiceValue, EffectDuration, GameEvent } from "../core";
import type { Cost } from "../cost";
import type {
  Amount,
  Comparison,
  Condition,
  Effect,
  KeywordName,
  Modifier,
  PlayerSelector,
  Selector,
  Trigger,
  ZoneSelector,
} from "../effects";

/** §5 — effect/choice/trigger rejections (§6.2, §6.4, 411.2). */
export type EffectsReasonCode =
  "invalid_choice" | "manual_window_pending" | "no_manual_window" | "not_implemented";

/** 333 outstanding-task kinds owned by the effects layer (trigger/replacement/layer tasks). */
export type EffectsTaskKind = never;

/** 411.2 prompt kinds owned by the effects layer (order, multi-card selection, …). */
export type EffectsPromptKind = never;

/**
 * §6.2 Effect ops owned by the effects layer (most new `Effect` members land here).
 *
 * - `spend_buff` (702.2.b): remove one buff counter from a unit you control.
 * - `cost_then` (740.4.a / 383.3.b): "[do X] to [do Y]" — pay `cost` (a costed instruction),
 *   then run `effect`; `optional` = "you may …".
 * - `requires` (377.2.b): activation/play precondition ("Use this ability only while …"). At
 *   resolution it simply runs `effect`; `validateChoices` rejects when `condition` is false.
 * - `reflexive` (387–389): "Do this:" — adds `effect` to the chain as a new triggered item.
 * - `delayed` (390–393): creates a delayed triggered ability (stored in `RulesState.effects`).
 * - `continuous` (391.4 / 475): creates a continuous (delayed passive) effect.
 * - `remove_keyword` (801.3.b): removes a keyword for a duration.
 * - `choose` (355.18): resolution-time pick of objects bound under `key` (not targeted).
 * - `spend_counter` (745): remove counters from a game object.
 * - `add_counter` (741–749): place counters on a game object.
 * - `give_might` (479.4 arithmetic): like `temporary_might` but with an explicit duration and an
 *   optional snapshot `min` (479.4.b).
 * - `mark` (bookkeeping): record a per-turn marker in `RulesHistory.effects.marks`.
 */
export type EffectsEffectOp =
  | { op: "spend_buff"; target: Selector }
  | { op: "cost_then"; cost: Cost; effect: Effect; optional?: boolean; player?: PlayerSelector }
  | { op: "requires"; condition: Condition; effect: Effect; rule?: string }
  | { op: "reflexive"; effect: Effect; times?: Amount; optional?: boolean }
  | {
      op: "delayed";
      trigger: Trigger;
      effect: Effect;
      duration?: EffectDuration;
      once?: boolean;
      optional?: boolean;
    }
  | { op: "continuous"; modifier: Modifier; duration: EffectDuration; condition?: Condition }
  | { op: "remove_keyword"; keyword: KeywordName; target: Selector; duration?: EffectDuration }
  | {
      op: "choose";
      key: string;
      selector: Selector;
      min?: Amount;
      max?: Amount;
      chooser?: PlayerSelector;
      label?: string;
    }
  | { op: "spend_counter"; target: Selector; counter?: string; amount?: Amount }
  | { op: "add_counter"; target: Selector; counter: string; amount?: Amount }
  | {
      op: "give_might";
      amount: Amount;
      target: Selector;
      duration?: EffectDuration;
      min?: number;
    }
  | { op: "mark"; key: string; value?: ChoiceValue }
  /**
   * R3 — 355.14 / 418 / 715.3: "deal N damage split among …". `target` is a chosen selector
   * (each chosen unit is a Target, 355.14.a/.d); at most the damage available when played may be
   * chosen (355.14.c, Bonus Damage included, 715.3) — `target.maxCount` can only lower that cap.
   * At least one target unless `target.anyNumber` / `target.maxCount` ("any number of", 355.13).
   * On resolution the controller drops targets beyond the damage (355.14.h / h.1) and divides
   * the damage, ≥ 1 each (355.14.e–g), through a `damage-assignment` `effects.resume` prompt
   * answered with `assignments`.
   */
  | { op: "deal_split"; amount: Amount; target: Selector; source?: Selector };

/**
 * R3 — 355.11: a targeting requirement the chosen group must meet as a whole ("units at the same
 * location", "with total Might 4 or less", "with the same controller"). Checked on play
 * (355.11.a); on resolution a group that no longer qualifies is reduced to a maximal legal subset
 * of the original targets chosen by the controller (355.11.b / 355.11.b.1).
 */
export interface SelectorGroupRequirement {
  /** All chosen objects share one location ("at the same location", "at a single battlefield"). */
  sameLocation?: boolean;
  /** All chosen objects have the same controller. */
  sameController?: boolean;
  /** The chosen objects' total Might (each negative Might counts as 0, 143.2.c). */
  totalMight?: Comparison;
}

/**
 * Optional selector extensions (R2-effects; interface merging keeps the frozen `Selector` shape
 * intact). All fields are filters applied on top of the core ones.
 */
declare module "../effects" {
  interface Selector {
    /** Extra per-object condition; inside it the reference `"it"` is the candidate. */
    where?: Condition;
    /** 356 printed/total Energy cost comparison (cards and spells on the chain). */
    energyCost?: Comparison;
    /** Power cost comparison (number of power symbols). */
    powerCost?: Comparison;
    exhausted?: boolean;
    stunned?: boolean;
    buffed?: boolean;
    empowered?: boolean;
    /** 706–711: Might ≥ 5. */
    mighty?: boolean;
    /** 179–187: token game objects only (true) / non-tokens only (false). */
    token?: boolean;
    /** Exclude objects bound under these choice keys ("another …"). */
    excludeRefs?: string[];
    /** The object must be at the same location as the object bound to this ref. */
    sameLocationAs?: string;
    /** Free-form UI label for prompts. */
    label?: string;
    /** R3 — 355.11: a requirement the chosen objects must meet as a group. */
    group?: SelectorGroupRequirement;
    /** R3 — 355.13: "any number of" — zero or more of the legal choices (no upper count). */
    anyNumber?: boolean;
  }

  interface EventMatcher {
    /** The event's subject (cardId/objectId) must match this selector (refs: "self", …). */
    subject?: Selector;
    /** The event's origin zone (`data.from`) must match. */
    from?: ZoneSelector;
    /** `GameEvent.playerId` must be "you"/an opponent (412.4 responsibility). */
    player?: PlayerSelector;
  }

  interface TokenSpec {
    /** Token tags (187). */
    tags?: string[];
    /** Count as "played" (420/440.2.c) rather than merely created. */
    play?: boolean;
  }
}

/** R3 — 832.1.d.1: the shown-off objects and their information when they were shown off. */
export interface ShowOffInfo {
  ids: string[];
  might?: number;
  energy?: number;
  power?: number;
}

/** A prevention shield (438) tracked on a unit. */
export interface PreventShield {
  id: string;
  /** Remaining Prevent Value; "all" never decreases (438.3.c). */
  value: number | "all";
  duration: EffectDuration;
  /** Turn number the shield was created on (for "this turn"). */
  turn: number;
  sourceObjectId?: string;
  /** Controller of the effect that created it ("until your next turn"). */
  controller?: string;
}

/** A keyword granted (or removed) on one object with a duration (801.3.a). */
export interface ObjectKeywordGrant {
  id: string;
  keyword: string;
  value?: number;
  duration: EffectDuration;
  turn: number;
  removed?: boolean;
  sourceObjectId?: string;
  controller?: string;
}

/** A Might modification on one object with a non-"this turn" duration (479.4). */
export interface ObjectMightMod {
  id: string;
  amount: number;
  duration: EffectDuration;
  turn: number;
  sourceObjectId?: string;
  controller?: string;
}

/** 418 object state added by the effects layer (granted keywords, prevention shields, …). */
export interface EffectsObjectFields {
  /** 442: Empowered status (a count when stacking is permitted, 442.1.c.1). */
  empowered?: number;
  /** 438: prevention shields. */
  prevent?: PreventShield[];
  /** 801.3: keyword grants/removals with durations. */
  keywordGrants?: ObjectKeywordGrant[];
  /** 479.4: Might modifications whose duration is not "this turn". */
  mightMods?: ObjectMightMod[];
  /**
   * 355.1.a / 356.4.f.1: the optional additional cost was paid when this permanent was played
   * (copied from its chain item's choices when it finalized), for "if you paid the additional
   * cost" play effects.
   */
  paidAdditionalCost?: boolean;
  /**
   * R3 — 832.1.c.1 / 832.1.d.1: what this permanent showed off as it was played (ids and the
   * information noted then), for its linked "if you showed off" abilities.
   */
  showOff?: ShowOffInfo;
  /**
   * 359.3.e.4: chain items that chose this object while it was on the board. The rules object is
   * dropped when the object leaves the board, so a target that left and came back no longer
   * carries the item id (it is "not the same object").
   */
  targetedBy?: string[];
}

/** Per-turn bookkeeping kept by the effects layer (reset with `RulesHistory` each turn). */
export interface EffectsHistoryState {
  /** 383.3.e / 386: uses of limited abilities this turn, keyed `<objectId>|<abilityRef>`. */
  limits?: Record<string, number>;
  /** Arbitrary per-turn markers (`mark` op), e.g. modes already chosen this turn. */
  marks?: Record<string, ChoiceValue>;
  /** 371: replacement effects already applied this turn, keyed by replacement id. */
  replacements?: Record<string, number>;
  /** Cards played this turn in order (card ids), for "first card each turn" conditions. */
  played?: Record<string, string[]>;
}

/** `RulesHistory` counters owned by the effects layer (triggered/played-from-zone, …). */
export interface EffectsHistoryFields {
  effects?: EffectsHistoryState;
}

/** `PromptAnswer` fields used by effect prompts. */
export interface EffectsPromptAnswerFields {
  /** Ordering prompts (e.g. order cards put on top of the deck). */
  orderedIds?: string[];
  /** `choose_mode` answers. */
  modes?: string[];
}

/** Snapshot of a chosen target taken when the item finalized (359.3.e.2 / 359.3.e.4). */
export interface TargetSnapshot {
  zone: string;
  controller?: string;
}

/** `ChainItem` extras owned by the effects layer (trigger/replacement provenance, …). */
export interface EffectsChainItemFields {
  /** Inline effect for triggered items without a card-script ability (delayed/reflexive). */
  effect?: Effect;
  /** The event that triggered a triggered item (383.2.c.3.b noted information). */
  triggerEvent?: GameEvent;
  /** Name of the source for display / script lookup when it differs from `cardName`. */
  sourceName?: string;
  /** 383.3.a / 388.4: "you may" is the first part of this trigger's effect. */
  optional?: boolean;
  /** 403.1: the "you may" decision has been made for this triggered item. */
  mayDecided?: boolean;
  /** 359.3.e: zones of chosen targets (by object id) when the item finalized. */
  targetSnapshot?: Record<string, TargetSnapshot>;
  /** Choices bound by the effects layer during resolution (diagnostics). */
  resolutionChoices?: ChoiceRecord;
  /**
   * R3 — 829.1.b.1: where the card goes when it leaves the chain other than by its own
   * instructions (a spell played for its Flow cost is banished instead of going to the trash).
   */
  leaveChainTo?: "banished";
  /**
   * 820.1.d / 820.3: how many executions of this item's instructions have completed. The
   * resolution loop runs the script `1 + paid Repeat instances` times and an `effects.resume`
   * prompt resumes the remaining runs from here.
   */
  repeatExecutionsDone?: number;
}

/** `LegalIntents` extras owned by the effects layer (prompt details, …). */
export interface EffectsLegalIntentsFields {}

/** `WhoMayAct.window` members owned by the effects layer. */
export type EffectsWhoWindow = never;

/** `WhoMayAct.kind` members owned by the effects layer. */
export type EffectsWhoKind = never;
