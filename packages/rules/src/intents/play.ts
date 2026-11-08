/** `rules_play` — rules 349–359 process of play. */
import type { ChainItem } from "@rift/protocol";
import { fail, pushEvent } from "../types";
import { playCardVerdict } from "../legality/play";
import { appendChainItem, finalizeChainItem, passPriority, runCleanupOrQueue } from "../timing/fepr";
import { grantPriority } from "../state";
import { normalizeChoices, type IntentContext, type IntentResult } from "./context";

export function handlePlay(context: IntentContext): IntentResult {
  const { room, rules, actorId, intent, ctx, host, step } = context;
  if (intent.type !== "rules_play") return fail("unknown_intent", "contract:§5");
  // 420.1.a + timing + 355.2.a/359.2.d: one verdict, before any mutation (358.5).
  const verdict = playCardVerdict(room, actorId, intent.cardId, host, intent.location);
  if (!verdict.ok) return verdict;
  const snapshot = host.takeCard(room, actorId, verdict.located.zone, intent.cardId);
  if (!snapshot) return fail("card_not_found", "354");
  const info = verdict.info;
  const type = (info?.type ?? snapshot.type ?? "").toLowerCase();
  const item: ChainItem = {
    id: host.nextId("chain"),
    kind: "card",
    status: "pending",
    controller: actorId,
    cardName: info?.name ?? snapshot.name,
    ...(snapshot.cardCode ? { cardCode: snapshot.cardCode } : {}),
    choices: normalizeChoices(intent.choices),
    ...(intent.payment ? { paid: intent.payment } : {}),
    origin: "play",
    fromZone: verdict.located.zone,
    cardSnapshot: snapshot,
    addedAt: ctx.now,
  };
  // 355.2.a / 359.2.d: only permanents carry a location; the verdict normalized it.
  if (type.includes("unit") || type.includes("gear")) item.choices.location = verdict.location;
  appendChainItem(room, item, step);
  rules.history.cardsPlayedThisTurn[actorId] = (rules.history.cardsPlayedThisTurn[actorId] ?? 0) + 1;
  pushEvent(step.events, {
    type: "card_played",
    cardId: intent.cardId,
    playerId: actorId,
    cardName: item.cardName,
    data: { itemId: item.id, hold: intent.hold === true },
  });

  finalizeChainItem(room, item, step);
  runCleanupOrQueue(room, step);
  if (rules.chain.some((entry) => entry.id === item.id)) {
    // 337.4: after finalizing, the controller of the newest item gains Priority.
    grantPriority(rules, item.controller);
    // Owner decision 3: auto-pass so the opponent gets the window at once — but never pass
    // on behalf of a player who no longer holds Priority (F1, e.g. an immediate permanent).
    if (!intent.hold && rules.priority === actorId) passPriority(room, actorId, step);
  }
  return { ok: true };
}
