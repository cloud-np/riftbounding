/**
 * 323.12: the Turn Player chooses a staged Combat; Combat begins at that battlefield. The
 * cleanup emits this prompt with `data.reason = PROMPT_REASONS.stageCombat`.
 */
import type { BattlefieldZone } from "@rift/protocol";
import { beginCombat } from "../combat";
import { fail } from "../types";
import { chosenPromptOption, registerPromptHandler } from "./handlers";
import { PROMPT_REASONS } from "./reasons";

registerPromptHandler(PROMPT_REASONS.stageCombat, ({ room, prompt, answer, step }) => {
  const option = chosenPromptOption(prompt, answer);
  const offered = !!prompt.options && prompt.options.length > 0;
  // 411.2/NEW-11: the battlefield comes from the chosen offered option, never a stray zone.
  const zone = option?.zone ?? option?.id ?? (!offered && typeof answer.zone === "string" ? answer.zone : undefined);
  if (typeof zone !== "string") return fail("invalid_choice", prompt.rule ?? "323.12");
  if (offered) {
    const offeredZone = prompt.options!.some((entry) => entry.id === zone || entry.zone === zone);
    if (!offeredZone) return fail("invalid_choice", prompt.rule ?? "323.12");
  }
  if (!beginCombat(room, zone as BattlefieldZone, step)) {
    return fail("invalid_choice", prompt.rule ?? "323.12");
  }
  return { ok: true };
});
