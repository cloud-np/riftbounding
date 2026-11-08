/**
 * Strict-rules wire types owned by wave R2-play.
 * Owned by wave R2-play. Add your union members / optional fields here only.
 *
 * Process of play (349–359), costs/payment, targets, activated abilities (376–381/399+) and
 * the Standard Move (449–455). `../core.ts` composes these hooks into the exported wire types.
 * Keep every added field optional so R1 consumers keep compiling.
 */

import type { RulesDomain } from "../core";
import type { Cost } from "../cost";

/** §5 — cost/payment/target/location rejections raised by the play layer (349–359, 449–455). */
export type PlayReasonCode =
  | "insufficient_resources"
  | "illegal_target"
  | "no_legal_targets"
  | "invalid_location"
  | "unit_exhausted"
  | "unit_not_found"
  | "card_not_found"
  | "not_in_hand"
  /** 357: an explicit payment plan does not pay the total cost exactly / uses illegal sources. */
  | "invalid_payment"
  /** 475–479 restriction layer (“can't …”) forbids the play/activation/move. */
  | "restricted";

/** 333 outstanding-task kinds owned by the play layer (payment/choice tasks). */
export type PlayTaskKind = never;

/**
 * 411.2 prompt kinds owned by the play layer. `choose-cost` asks which objects pay a
 * non-standard cost (357.2: exhaust/discard/kill) when more than one choice is possible.
 */
export type PlayPromptKind = "choose-cost";

/** §6.2 Effect ops owned by the play/cost layer (composed into `Effect`). */
export type PlayEffectOp = never;

/** 418 object state added by the play layer (deployment/enter flags, …). */
export interface PlayObjectFields {
  /** 811.1.b: turn number on which this card was hidden facedown (it gains Reaction later). */
  hiddenTurn?: number;
  /** 811.1.b: the player who hid this card. */
  hiddenBy?: string;
}

/** `RulesHistory` counters owned by the play layer (played/paid-per-turn, …). */
export interface PlayHistoryFields {
  /** 812.1.c: card ids each player finalized this turn (Legion). Cleared each turn. */
  finalizedCardsThisTurn?: Record<string, string[]>;
  /** 376+/Limit: activations this turn keyed by `<objectId>::<abilityRef>`. */
  activationsThisTurn?: Record<string, number>;
  /** Turn number the per-turn play counters above belong to. */
  playHistoryTurn?: number;
}

/** `PromptAnswer` fields used by play prompts (payment rune ids, power, …). */
export interface PlayPromptAnswerFields {}

/**
 * Explicit payment selection for one play/activation (356/357). Two independent categories:
 *
 * - **resources** (`poolEnergy`/`poolPower`/`exhaustRunes`/`recycleRunes`): when any of these
 *   fields is present the plan is taken literally and must pay the Energy and Power cost
 *   exactly; otherwise the engine auto-plans (Rune Pool first, then exhausted runes are recycled
 *   before ready ones; any ready rune is equivalent for [1]).
 * - **non-standard objects** (`exhaust`/`discard`/`kill`): each field, when present, names the
 *   objects used for that cost; when absent and more than one choice exists the engine opens a
 *   `choose-cost` prompt (411.2).
 */
export interface PaymentPlanWire {
  /** Floating Energy taken from the Rune Pool. */
  poolEnergy?: number;
  /** Floating Power taken from the Rune Pool, per domain (`any` = universal [A]). */
  poolPower?: Partial<Record<RulesDomain | "any", number>>;
  /** Runes exhausted for [1] each (164.2.a). */
  exhaustRunes?: string[];
  /** Runes recycled for one Power of their Domain each (164.2.b). */
  recycleRunes?: string[];
  /** Objects exhausted to pay an exhaust cost (357.2). */
  exhaust?: string[];
  /** Hand cards discarded to pay a discard cost (357.2). */
  discard?: string[];
  /** Units/gear killed to pay a kill cost (357.2). */
  kill?: string[];
}

/** 354/356.1: the permission a card is played with (hand, facedown, an effect's permission). */
export interface PlayPermissionWire {
  id: string;
  rule: string;
  /** 356.1.a: "for [Cost]". */
  cost?: Cost;
  /** 356.1.b: ignored Base Cost part. */
  ignore?: "base" | "energy" | "power";
  /** 356.5.a: ignoring any and all costs. */
  ignoreAll?: boolean;
  /** Permissive keywords granted while played this way (811.6). */
  keywords?: string[];
  /** 811.1.d: the battlefield a facedown card is played from. */
  facedownAt?: string;
}

/** 355–358: where a Pending item stands in the process of play while a prompt is open. */
export interface PlayProcessState {
  /** A played card (349–359) or an activated ability (399–407). */
  kind?: "card" | "activated";
  /** `choices` (355, R2-effects choice specs) or `payment` (357.2 cost-object choice). */
  stage: "choices" | "payment";
  /** The permission the card is played with (card items only). */
  permission?: PlayPermissionWire;
  /** 358.5 undo: the zone/index/owner the card was played from (card items only). */
  fromZone?: string;
  fromIndex?: number;
  fromPlayerId?: string;
  /** 358.5 undo: Priority/Focus/passes before the play started. */
  saved: { priority: string | null; focus: string | null; passes: string[] };
  /** The request data still needed to finish the process. */
  request: {
    plan?: PaymentPlanWire;
    optionalCosts?: string[];
    hold?: boolean;
    baseCost?: number;
    location?: string;
  };
  /** Choice key (`ChoiceSpec.key`) or cost category the open prompt answers. */
  awaiting?: string;
}

/** `ChainItem` extras owned by the play layer (cost payment, 355 target binding, …). */
export interface PlayChainItemFields {
  /** Present only while the item is Pending and waiting on a play prompt (355–357). */
  process?: PlayProcessState;
  /** 355.1.a: optional additional costs the controller chose to pay (ids, e.g. "accelerate"). */
  optionalCosts?: string[];
  /** 356: the total Energy/Power cost determined for this item (after modifiers). */
  totalCost?: { energy: number; power: number };
  /** 811.1.d: the battlefield a facedown card was played from. */
  playedFromFacedown?: string;
}

/** One playable card with the information a client needs to build a complete `rules_play`. */
export interface PlayableCardDetail {
  cardId: string;
  /** 355.2: valid locations (units/gear). */
  locations: string[];
  /** 355.1.a: optional additional costs that may be chosen (ids). */
  optionalCosts: string[];
  /** 356: total Energy/Power cost before optional costs. */
  cost: { energy: number; power: number };
  /** 811: playable from facedown. */
  fromFacedown?: boolean;
}

/** `LegalIntents` extras owned by the play layer (affordability, hold flags, …). */
export interface PlayLegalIntentsFields {
  /** Details for each entry of `playableCardIds` (same order). */
  playable?: PlayableCardDetail[];
  /** 811.1.b: cards that may be hidden now, with the battlefields they may be hidden at. */
  hideable?: Array<{ cardId: string; locations: string[] }>;
}

/** `WhoMayAct.window` members owned by the play layer (none yet; core has main/chain/showdown). */
export type PlayWhoWindow = never;

/** `WhoMayAct.kind` members owned by the play layer. */
export type PlayWhoKind = never;

/**
 * Convenience aliases shared by `rules_play` and `rules_activate`. `choices` stays canonical:
 * the aliases are copied into `choices` only when the key is not already bound
 * (`x` → `"x"`, `modes` → `"mode"`, `targets[i]` → `"target:<i>"`).
 */
export interface PlayChoiceAliasFields {
  /** 357: explicit payment selection; omitted parts are auto-planned. */
  plan?: PaymentPlanWire;
  /** 355.1.a: ids of the optional additional costs to pay (e.g. "accelerate", "repeat"). */
  optionalCosts?: string[];
  /** 355.5/355.7 targets, in choice order. */
  targets?: string[];
  /** 355 X value. */
  x?: number;
  /** 355.3 modes. */
  modes?: string[];
  /** 204.1.b: index of the chosen alternative base cost (e.g. "[1] or [C]"). */
  baseCost?: number;
}

/** `rules_play` payload extras (355 targets, X, modes, runeIds, …). */
export interface PlayPlayIntentFields extends PlayChoiceAliasFields {
  /** 811.1.b: take the Hide discretionary action instead of playing (`location` = battlefield). */
  hide?: boolean;
}

/** `rules_activate` payload extras (payment/target choices, …). */
export interface PlayActivateIntentFields extends PlayChoiceAliasFields {}
