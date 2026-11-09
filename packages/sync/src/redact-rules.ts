/**
 * Per-viewer redaction of the strict-rules state (`Room.rules`).
 *
 * Privacy rules (Riftbound Core Rules 2026-10-09):
 *
 *  - 128.4  Private: only the controller of a card on the board, or the owner of a card in any
 *           other zone, may look at its face. Hands and decks are private/secret (108/109).
 *  - 107.3.f Facedown Zones are public, but facedown cards there are private.
 *  - 108.1.b Cards and abilities on the Chain are public; a facedown (Hidden, 811) card is only
 *           revealed when it changes zones (422.4), so a chain card still marked `hidden` is not.
 *  - 425 / 437 Looked-at, searched and predicted cards are seen by the looking player only.
 *
 * Card ids encode the card (`setup-<owner>-<source>-<index>-<slug>`), so an id is as revealing
 * as the card face. The board redaction (`redact.ts`) replaces every private card with a
 * `__hidden_zone__:<player>:<zone>:<index>` placeholder; this module rewrites every reference
 * to such a card inside `Room.rules` to the *same* placeholder id, and strips the strict-only
 * private payloads (other players' prompts, hidden chain items, private object state, private
 * prompt answers). The result is still a `RulesState`.
 */

import type {
  CardInstance,
  ChainItem,
  GameEvent,
  PendingTrigger,
  Prompt,
  PromptData,
  RulesState,
} from "@rift/protocol";

export interface RulesRedactionContext {
  /** Seats whose private information this viewer may read (own seat, controlled, granted). */
  owned: ReadonlySet<string>;
  /** Private card id → the placeholder id the redacted board shows for that card. */
  privateIds: ReadonlyMap<string, string>;
  /** 811 / 128.4: whether a hidden card snapshot was revealed to this viewer. */
  isRevealed: (card: CardInstance) => boolean;
  /** The placeholder the redacted `chainEntries` shows for a hidden chain card. */
  placeholder: (playerId: string, zone: string, index: number) => CardInstance;
}

type IdReplacer = (value: string) => string;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/**
 * Replace every private card id (also inside composite keys such as `<objectId>::<ability>`)
 * with its placeholder. Longest ids first so an id that prefixes another is never split.
 */
function idReplacer(
  privateIds: ReadonlyMap<string, string>,
  exempt?: ReadonlySet<string>,
): IdReplacer {
  const ids = [...privateIds.keys()].filter((id) => id.length > 0 && !exempt?.has(id));
  if (ids.length === 0) return (value) => value;
  ids.sort((left, right) => right.length - left.length);
  const pattern = new RegExp(ids.map(escapeRegExp).join("|"), "gu");
  return (value) => {
    pattern.lastIndex = 0;
    if (!pattern.test(value)) return value;
    pattern.lastIndex = 0;
    return value.replace(pattern, (match) => privateIds.get(match) ?? match);
  };
}

/** Deep copy of a JSON value with every string (values and keys) passed through `replace`. */
function scrub<T>(value: T, replace: IdReplacer): T {
  if (typeof value === "string") return replace(value) as T;
  if (Array.isArray(value)) return value.map((item: unknown) => scrub(item, replace)) as T;
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item === undefined) continue;
    out[replace(key)] = scrub(item, replace);
  }
  return out as T;
}

/**
 * 128.4 / 411.2: a pending prompt is visible to the prompted player (and to viewers who control
 * or were granted that seat). Everyone else learns only that player X has a prompt of this kind
 * pending; options, bounds and `data` (looked-at/searched ids, the `effects.resume`
 * continuation, damage-assignment targets) are removed.
 */
function redactPrompt(prompt: Prompt, context: RulesRedactionContext): Prompt {
  if (!context.owned.has(prompt.playerId)) {
    const data: PromptData = {};
    if (typeof prompt.data?.reason === "string") data.reason = prompt.data.reason;
    return {
      id: prompt.id,
      kind: prompt.kind,
      playerId: prompt.playerId,
      ...(prompt.promptKey !== undefined ? { promptKey: prompt.promptKey } : {}),
      ...(prompt.rule !== undefined ? { rule: prompt.rule } : {}),
      ...(prompt.sourceItemId !== undefined ? { sourceItemId: prompt.sourceItemId } : {}),
      ...(data.reason !== undefined ? { data } : {}),
    };
  }
  // The prompted player sees the options the engine offered, even another player's cards
  // (e.g. a look at an opponent's hand). The continuation is server bookkeeping: any other
  // private id in it (the rest of the interpreter environment) is still rewritten.
  const continuation = prompt.data?.continuation;
  if (continuation === undefined) return prompt;
  const offered = new Set<string>();
  for (const option of prompt.options ?? []) {
    for (const id of [option.id, option.cardId, option.objectId, option.value]) {
      if (typeof id === "string") offered.add(id);
    }
  }
  return {
    ...prompt,
    data: {
      ...prompt.data,
      continuation: scrub(continuation, idReplacer(context.privateIds, offered)),
    },
  };
}

/** Index of a chain item in the newest-first `Room.chainEntries` display projection. */
function displayIndex(rules: RulesState, index: number): number {
  return rules.chain.length - 1 - index;
}

/**
 * 108.1.b / 811 / 422.4: chain items are public, except a card whose snapshot is still facedown
 * and was not revealed to this viewer. Such an item keeps its timing facts only.
 */
function redactChainItem(
  rules: RulesState,
  item: ChainItem,
  index: number,
  context: RulesRedactionContext,
): ChainItem {
  const card = item.cardSnapshot;
  if (!card?.hidden) return item;
  if (context.owned.has(item.controller)) return item;
  if (context.isRevealed(card)) return item;
  return {
    id: item.id,
    kind: item.kind,
    status: item.status,
    controller: item.controller,
    origin: item.origin,
    choices: {},
    cardSnapshot: context.placeholder(item.controller, "chain", displayIndex(rules, index)),
    ...(item.fromZone !== undefined ? { fromZone: item.fromZone } : {}),
    ...(item.addedAt !== undefined ? { addedAt: item.addedAt } : {}),
    ...(item.playedFromFacedown !== undefined
      ? { playedFromFacedown: item.playedFromFacedown }
      : {}),
  };
}

function isPrivateRef(id: unknown, context: RulesRedactionContext): boolean {
  return typeof id === "string" && context.privateIds.has(id);
}

/** A stored event about a private card (a draw, a look) must not carry its name. */
function redactEvent(event: GameEvent, context: RulesRedactionContext): GameEvent {
  const subjects = [event.cardId, event.objectId, event.sourceObjectId];
  if (!subjects.some((id) => isPrivateRef(id, context))) return event;
  const { cardName: _cardName, ...rest } = event;
  return rest;
}

function redactTrigger(trigger: PendingTrigger, context: RulesRedactionContext): PendingTrigger {
  let next = trigger;
  if (isPrivateRef(trigger.sourceObjectId, context) && trigger.sourceName !== undefined) {
    const { sourceName: _sourceName, ...rest } = trigger;
    next = rest;
  }
  if (next.event) next = { ...next, event: redactEvent(next.event, context) };
  return next;
}

/** Redact one viewer's copy of `Room.rules` (the input is not mutated). */
export function redactRulesForViewer(
  rules: RulesState,
  context: RulesRedactionContext,
): RulesState {
  const replace = idReplacer(context.privateIds);

  const chain = rules.chain.map((item, index) => {
    const redacted = redactChainItem(rules, item, index, context);
    return redacted.triggerEvent
      ? { ...redacted, triggerEvent: redactEvent(redacted.triggerEvent, context) }
      : redacted;
  });

  // 107.3.f / 128.4: object state of facedown cards and cards in private zones.
  const objects: RulesState["objects"] = {};
  for (const [id, state] of Object.entries(rules.objects)) {
    if (!context.privateIds.has(id)) objects[id] = state;
  }

  // Prompt answers are the answering player's decisions (looked-at/searched picks, 425/437).
  const promptAnswers = rules.history.promptAnswers?.filter((entry) =>
    context.owned.has(entry.playerId),
  );
  const history: RulesState["history"] = { ...rules.history };
  if (promptAnswers !== undefined) history.promptAnswers = promptAnswers;

  // Auto-pass preferences (docs/rules/auto-pass.md) are each seat's own settings: another
  // player must not learn which windows a seat skips (e.g. the leaky "no response" mode).
  const autoPass = rules.autoPass
    ? Object.fromEntries(Object.entries(rules.autoPass).filter(([playerId]) => context.owned.has(playerId)))
    : undefined;

  const { prompt, ...rest } = {
    ...rules,
    chain,
    objects,
    history,
    triggers: rules.triggers.map((trigger) => redactTrigger(trigger, context)),
    ...(autoPass ? { autoPass } : {}),
  };
  const scrubbed = scrub(rest, replace);
  return { ...scrubbed, prompt: prompt ? redactPrompt(prompt, context) : null };
}
