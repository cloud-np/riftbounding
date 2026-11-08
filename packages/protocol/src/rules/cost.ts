/**
 * @rift/protocol — strict-rules `Cost` shape (§6.1, 349–359).
 *
 * Owned by wave R2-play for extensions (see `./domains/play.ts`); R2-effects only reads it.
 */

import type { ChoiceValue, RulesDomain } from "./core";
import type { Amount, Selector } from "./effects";

export interface Cost {
  energy?: Amount;
  power?: Partial<Record<RulesDomain | "any", number>>;
  exhaust?: Selector;
  discard?: Amount;
  kill?: Selector;
  payPoints?: Amount;
  spendXp?: Amount;
  /** Extra cost imposed by a passive/layer effect. */
  additional?: Record<string, ChoiceValue>;
}
