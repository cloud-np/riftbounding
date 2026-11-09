/**
 * Keyword helpers for card scripts (F3/F5).
 */
import type { Ability, KeywordName } from "@rift/protocol";

/**
 * The catalog lists these keywords for the card, but they are not its own printed keywords
 * (reminder text, quoted granted text, an ability's keyword, or a dependent ability: 727.1.b,
 * 831.2). The layers then ignore the catalog entries; spread the result into `abilities`.
 */
export function notIntrinsic(...keywords: KeywordName[]): Ability[] {
  return keywords.map((keyword) => ({ kind: "suppress-printed-keyword" as const, keyword }));
}
