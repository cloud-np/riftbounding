/** `rules_activate` — rules 376–381, 399+, 430.2. */
import type { ChainItem } from "@rift/protocol";
import { fail, pushEvent } from "../types";
import { activationVerdict } from "../legality/activate";
import { appendChainItem, finalizeChainItem, passPriority, runCleanupOrQueue } from "../timing/fepr";
import { grantPriority } from "../state";
import { normalizeChoices, type IntentContext, type IntentResult } from "./context";

export function handleActivate(context: IntentContext): IntentResult {
  const { room, rules, actorId, intent, ctx, host, step } = context;
  if (intent.type !== "rules_activate") return fail("unknown_intent", "contract:§5");
  // 376–381/403.3: source on the Board + an actual activated ability + its own keywords.
  const verdict = activationVerdict(room, actorId, intent.objectId, intent.ability, host);
  if (!verdict.ok) return verdict;
  const ability = verdict.ability;
  const isAdd = ability.addsResources === true;
  const item: ChainItem = {
    id: host.nextId("chain"),
    kind: "activated",
    status: "pending",
    controller: actorId,
    sourceObjectId: intent.objectId,
    cardName: verdict.located.card.name,
    abilityRef: verdict.ref,
    choices: normalizeChoices(intent.choices),
    ...(intent.payment ? { paid: intent.payment } : {}),
    // 430.2: Add abilities finalize and resolve immediately.
    origin: isAdd ? "add" : "play",
    addedAt: ctx.now,
  };
  // 430.2.a: Add abilities never pass Priority or Focus, and never disturb the pass count.
  const savedPriority = rules.priority;
  const savedFocus = rules.focus;
  const savedPasses = [...rules.passes];
  appendChainItem(room, item, step);
  finalizeChainItem(room, item, step);
  if (isAdd) {
    rules.priority = savedPriority;
    rules.focus = savedFocus;
    rules.passes = savedPasses;
  }
  runCleanupOrQueue(room, step);
  if (!isAdd && rules.chain.some((entry) => entry.id === item.id)) {
    grantPriority(rules, item.controller);
    if (!intent.hold && rules.priority === actorId) passPriority(room, actorId, step);
  }
  return { ok: true };
}
