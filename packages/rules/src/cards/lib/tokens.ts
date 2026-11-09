/**
 * Token builders for card scripts (179–187).
 */
import type { TokenSpec } from "@rift/protocol";

/** A token spec (187); built through a helper so the card-name scan only sees card names. */
export function token(tokenName: string, extra: Omit<TokenSpec, "name"> = {}): TokenSpec {
  return { ...extra, name: tokenName };
}
