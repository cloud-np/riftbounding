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

/** §6.1 — keyed by unique card name (alt arts share a script). */
export interface CardScript {
  name: string;
  /** Card text the script was written from, after errata. */
  text: string;
  abilities: Ability[];
  status: "implemented" | "partial" | "manual";
  notes?: string;
  /**
   * 820.1.d: the script executes the repeated instructions itself (through an
   * "if you paid the Repeat cost" helper). Set while a script still carries the pre-engine-Repeat
   * workaround; the resolution loop must not execute it again. R4-cards removes the workarounds.
   */
  repeatHandled?: boolean;
}
