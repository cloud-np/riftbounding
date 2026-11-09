/**
 * Small builders for card scripts (§6.1/§6.2). Pure data helpers — no registration here.
 */
import type { TokenSpec } from "@rift/protocol";

export { EVENT_SUBJECT, HERE, HOST, SELF, aUnit } from "./lib/selectors";
export {
  WHEN_A_UNIT_MOVES_FROM_HERE,
  WHEN_I_BECOME_EXHAUSTED,
  WHEN_I_DIE,
  WHEN_I_MOVE,
  WHEN_PLAYED,
  WHEN_YOU_CONQUER_HERE,
  WHEN_YOU_DEFEND_HERE,
  WHEN_YOU_HOLD_HERE,
} from "./lib/triggers";

export { PAID_ADDITIONAL, SELF_AT_BATTLEFIELD, SHOWED_OFF, custom, marked, not } from "./lib/conditions";
export { showOff } from "./lib/passives";

/** A token spec (187); built through a helper so card-coverage only sees card names. */
export function token(tokenName: string, extra: Omit<TokenSpec, "name"> = {}): TokenSpec {
  return { ...extra, name: tokenName };
}
