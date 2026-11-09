/**
 * Forced decisions — rule 411.2 Limited Actions with exactly one legal answer.
 *
 * The process of play already binds forced play-time choices (355 / 403.2), forced cost objects
 * (357.2) and a single legal combat damage assignment (467.2.c) without a prompt. What can still
 * reach the player is a prompt that the creator opened even though only one answer is legal
 * (an opponent choice in a duel, "choose N" among exactly N options, an order of identical
 * triggers, …). `forcedPromptAnswer` recognises those and reports whether that single answer
 * follows from public information (`docs/rules/auto-pass.md` § hidden information).
 *
 * Pure: reads the room only. The caller still runs the normal `chooseVerdict` before applying
 * the answer, so an automatic answer is always one the player could have sent.
 */
import type { PendingTrigger, Prompt, PromptAnswer, PromptOption, Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { promptReason } from "../prompts/handlers";
import { EFFECTS_PROMPT_REASONS } from "../prompts/effects/reasons";
import { COMBAT_PROMPT_REASONS } from "../prompts/combat/reasons";

export interface ForcedAnswer {
  answer: PromptAnswer;
  /** True when the opponent could also tell that this was the only legal answer. */
  public: boolean;
}

/** Zones whose contents (and order) other players never see (128.4 / 107.3.f). */
const HIDDEN_ZONES: ReadonlySet<string> = new Set(["hand", "deck", "runeDeck"]);
/** Hidden zones whose size is public, so "every card there" is a public option set. */
const COUNTABLE_HIDDEN_ZONES: ReadonlySet<string> = new Set(["hand"]);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasGroupRequirement(prompt: Prompt): boolean {
  const data = record(prompt.data);
  const spec = record(data?.spec);
  const ask = record(data?.ask);
  return !!(record(data?.group) ?? record(spec?.group) ?? record(ask?.group));
}

/** 383.3.d: triggers whose order cannot change anything — the same ability of the same object
 *  for the same event, controlled by the same player. */
function identicalTriggers(triggers: readonly PendingTrigger[]): boolean {
  if (triggers.length <= 1) return true;
  const [first, ...rest] = triggers;
  const key = (trigger: PendingTrigger) =>
    JSON.stringify([
      trigger.controller,
      trigger.abilityRef ?? null,
      trigger.sourceObjectId ?? null,
      trigger.sourceName ?? null,
      trigger.optional === true,
      trigger.event ?? null,
    ]);
  const expected = key(first!);
  return rest.every((trigger) => key(trigger) === expected);
}

function orderAnswer(room: Room, options: readonly PromptOption[]): ForcedAnswer | null {
  const triggers = room.rules?.triggers ?? [];
  const offered = options
    .map((option) => triggers.find((trigger) => trigger.id === option.id))
    .filter((trigger): trigger is PendingTrigger => !!trigger);
  if (offered.length !== options.length) return null;
  if (!identicalTriggers(offered)) return null;
  // Listing nothing keeps detection order (383.3.d handler); triggers are public (108.1.b).
  return { answer: { optionIds: [] }, public: true };
}

/** Option ids standing for `objectIds` (ids, object ids or card ids), or null when one is missing. */
function optionIdsFor(options: readonly PromptOption[], objectIds: readonly unknown[]): string[] | null {
  const out: string[] = [];
  for (const id of objectIds) {
    const option = options.find((entry) => entry.id === id || entry.objectId === id || entry.cardId === id);
    if (!option) return null;
    out.push(option.id);
  }
  return out;
}

/** Is every hidden object among the options matched by "every card of that hidden zone"? */
function optionsArePublic(room: Room, host: RulesHost, options: readonly PromptOption[]): boolean {
  const hiddenGroups = new Map<string, Set<string>>();
  for (const option of options) {
    const ids = [option.objectId, option.cardId].filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    );
    for (const id of new Set(ids)) {
      const located = host.findCard(room, id);
      // Not a card on any board (a chain item, trigger, player, battlefield or value): public.
      if (!located) continue;
      const hidden = HIDDEN_ZONES.has(located.zone) || located.card.hidden === true;
      if (!hidden) continue;
      if (!COUNTABLE_HIDDEN_ZONES.has(located.zone) && located.card.hidden !== true) return false;
      const key = `${located.playerId}\u0000${located.zone}`;
      const group = hiddenGroups.get(key) ?? new Set<string>();
      group.add(located.card.id);
      hiddenGroups.set(key, group);
    }
  }
  for (const [key, chosen] of hiddenGroups) {
    const [playerId, zone] = key.split("\u0000") as [string, string];
    // The count of facedown cards at a battlefield and of cards in hand is public (107.3.f);
    // the option set reveals nothing only when it is *all* of them.
    const all = host
      .zoneCards(room, playerId, zone)
      .filter((card) => COUNTABLE_HIDDEN_ZONES.has(zone) || card.hidden === true)
      .map((card) => card.id);
    if (all.length !== chosen.size || all.some((id) => !chosen.has(id))) return false;
  }
  return true;
}

/**
 * The single legal answer of `prompt`, or null when the player has a real choice (or when the
 * prompt's shape is not one this module can prove forced).
 */
export function forcedPromptAnswer(room: Room, prompt: Prompt, host: RulesHost): ForcedAnswer | null {
  const options = prompt.options ?? [];
  // Legacy/free-form prompts (manual instructions) have no option list to prove anything with.
  if (options.length === 0) return null;
  const enabled = options.filter((option) => option.disabled !== true);
  if (enabled.length === 0) return null;
  const reason = promptReason(prompt);
  const data = record(prompt.data);
  const ask = record(data?.ask);

  // 467.2.c: the combat layer already assigns a single legal distribution without a prompt.
  if (reason === COMBAT_PROMPT_REASONS.damageAssignment) return null;
  // 355.14: split damage — a real division whenever a prompt opened.
  if (ask?.answer === "split" || prompt.kind === "damage-assignment") return null;
  // 355.11: group requirements need the group evaluator; never guess them.
  if (hasGroupRequirement(prompt)) return null;
  // 383.3.d: an order only matters when the triggers differ.
  if (reason === EFFECTS_PROMPT_REASONS.orderTriggers || prompt.kind === "order") {
    return orderAnswer(room, enabled);
  }

  let ids: string[] | null = null;
  if (ask?.answer === "objects") {
    // 355.11.b.1: a known list of maximal legal subsets — forced only when there is one.
    const subsets = Array.isArray(ask.subsets) ? (ask.subsets as unknown[]) : null;
    if (subsets && subsets.length > 1) return null;
    if (subsets && subsets.length === 1) {
      const only = subsets[0];
      ids = Array.isArray(only) ? optionIdsFor(enabled, only) : null;
      if (!ids) return null;
    } else if (typeof ask.exact === "number" && ask.exact !== enabled.length) {
      return null;
    }
  }
  if (!ids) {
    const rawMin = Math.max(0, Math.trunc(prompt.min ?? 1));
    const rawMax = Math.max(rawMin, Math.trunc(prompt.max ?? options.length));
    // 411.2: the only legal selection is "all of the offered options".
    if (rawMin === enabled.length && rawMax >= enabled.length) ids = enabled.map((option) => option.id);
  }
  if (!ids) return null;

  const answer: PromptAnswer = { optionIds: ids };
  if (ids.length === 1) {
    const only = enabled[0]!;
    if (prompt.kind === "choose-opponent" || prompt.kind === "choose-player") {
      answer.playerId = only.playerId ?? only.id;
    }
  }
  return { answer, public: optionsArePublic(room, host, enabled) };
}
