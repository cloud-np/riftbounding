/** 323.11: the Turn Player chooses a staged Showdown; a Showdown begins there. */
import type { BattlefieldZone } from "@rift/protocol";
import { fail } from "../types";
import { beginShowdown } from "../timing/showdown";
import { chosenPromptOption, registerPromptHandler } from "./handlers";
import { PROMPT_REASONS } from "./reasons";

registerPromptHandler(PROMPT_REASONS.stageShowdown, ({ room, prompt, answer, step }) => {
  const rules = room.rules;
  if (!rules) return fail("rules_require_strict", "contract:§1");
  const option = chosenPromptOption(prompt, answer);
  const offered = !!prompt.options && prompt.options.length > 0;
  // 411.2/NEW-11: derive the battlefield from the chosen OFFERED option; a free-form
  // `answer.zone` is only a legacy fallback when the prompt offered no options at all.
  const zone = option?.zone ?? option?.id ?? (!offered && typeof answer.zone === "string" ? answer.zone : undefined);
  if (typeof zone !== "string" || !rules.staged.showdowns.includes(zone as BattlefieldZone)) {
    return fail("invalid_choice", prompt.rule ?? "323.11");
  }
  const startedBy = rules.contested[zone as BattlefieldZone] ?? rules.turn.player;
  beginShowdown(room, zone as BattlefieldZone, "non_combat", startedBy, step);
  return { ok: true };
});
