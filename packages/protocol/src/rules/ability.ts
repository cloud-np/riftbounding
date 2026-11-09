/**
 * @rift/protocol — card scripts and abilities (§6.1).
 *
 * Keyed by unique card name; alt arts share a script. R2-effects owns the interpreter that
 * consumes these; the shape here is the stable wire contract.
 */

import type { Cost } from "./cost";
import type {
  Amount,
  Condition,
  Effect,
  EventMatcher,
  KeywordName,
  Limit,
  Modifier,
  Trigger,
} from "./effects";

export type Ability =
  | { kind: "spell"; effect: Effect }
  | {
      kind: "triggered";
      trigger: Trigger;
      effect: Effect;
      optional?: boolean;
      condition?: Condition;
      limit?: Limit;
      keywords?: KeywordName[];
    }
  | {
      kind: "activated";
      cost: Cost;
      effect: Effect;
      keywords?: Array<"action" | "reaction" | KeywordName>;
      addsResources?: boolean;
      limit?: Limit;
      name?: string;
    }
  | { kind: "passive"; modifier: Modifier }
  | {
      kind: "replacement";
      matches: EventMatcher;
      replace: Effect | { prevent: Amount };
      limit?: Limit;
    }
  /**
   * F3: the catalog lists `keyword` for this card, but it is not one of the card's own printed
   * keywords — it appears only in reminder text, in quoted granted text, as an ability's keyword,
   * or in a dependent ability (727.1.b: Inactive until its condition holds; 831.2). The layers
   * then ignore the catalog entry; the keyword applies only when an ability actually grants it.
   * The registry integrity test lists the catalog keywords that need this marker.
   */
  | { kind: "suppress-printed-keyword"; keyword: KeywordName };

/**
 * 204.2 / 356.2: one of the card's own additional costs. Declaring `additionalCosts` on a script
 * replaces the printed-text parser for that card (keyword costs — Accelerate, Repeat, Deflect —
 * are still added by the engine only when the parser runs).
 */
export interface ScriptAdditionalCost {
  /** Stable id used by `rules_play.optionalCosts` (e.g. "optional:0", "repeat:1"). */
  id: string;
  optional: boolean;
  cost: Cost;
  rule: string;
  label?: string;
  /** 356.2.b.1: the cost is offered only while this holds (evaluated for the card being played). */
  condition?: Condition;
}

/**
 * 354 / 420.1.a: a zone other than hand / Chosen Champion this card may be played from
 * ("You may play me from your trash for [3] [Fury]").
 */
export interface ScriptPlayPermission {
  /** Stable id recorded on the chain item. */
  id: string;
  zone: "trash" | "banished" | "deck";
  rule: string;
  /** 356.1.a: play "for [Cost]" (replaces the Base Cost). */
  cost?: Cost;
  /** 356.1.b: ignore the Base Energy/Power cost. */
  ignore?: "base" | "energy" | "power";
  /** 356.5.a: ignore any and all costs. */
  ignoreAll?: boolean;
  /** The permission exists only while this holds (evaluated for the card, by its would-be player). */
  condition?: Condition;
}

/**
 * §6.1 — keyed by unique card name (alt arts share a script). The script is the whole card:
 * abilities, the card's own additional costs and extra play zones are all declared here (no side
 * registrations), as plain JSON.
 */
export interface CardScript {
  name: string;
  /** Card text the script was written from, after errata. */
  text: string;
  abilities: Ability[];
  status: "implemented" | "partial" | "manual";
  notes?: string;
  /** The card's own additional costs (204.2 / 356.2), replacing the printed-text parser. */
  additionalCosts?: ScriptAdditionalCost[];
  /** Extra zones this card may be played from (354 / 420.1.a). */
  playPermissions?: ScriptPlayPermission[];
}
