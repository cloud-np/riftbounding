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
  | { kind: "keyword"; keyword: KeywordName; value?: number };

/** §6.1 — keyed by unique card name (alt arts share a script). */
export interface CardScript {
  name: string;
  /** Card text the script was written from, after errata. */
  text: string;
  abilities: Ability[];
  status: "implemented" | "partial" | "manual";
  notes?: string;
}
