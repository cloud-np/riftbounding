/**
 * "Very dumb AI" — the pure, seeded action picker for strict mode.
 *
 * The bot only reads. It never mutates the `Room` it is given, never uses `Math.random`,
 * `Date`, timers or I/O, and draws every random decision from the injected `random`.
 * Callers that drive a live seat must pass the bot's **redacted** view (see
 * `packages/sync/src/redact.ts`), never the authoritative room.
 *
 * Action policy (uniform among the highest-priority legal category):
 *   1. answer the open prompt (411.2);
 *   2. close the §6.4 manual window (unscripted cards otherwise stall);
 *   3. play / hide / activate / move;
 *   4. end the turn;
 *   5. pass — only when nothing else is legal.
 *
 * `pickPromptAnswer` covers every `PromptKind` and prompt reason emitted by the engine. It
 * returns `null` only when no answer can satisfy the offer:
 *   - an offered option count whose `min` exceeds `options.length` (malformed prompt);
 *   - a damage-assignment prompt whose targets cannot be assigned a legal distribution;
 *   - a split-damage prompt whose total is smaller than one per target;
 *   - a group / subset decision whose offered ids do not form a legal choice;
 *   - an `objects` decision whose offered object ids cannot be mapped back to options.
 */
import type {
  Prompt,
  PromptAnswer,
  PromptOption,
  Room,
  RulesIntent,
  SelectorGroupRequirement,
  ZoneSelector,
} from "@rift/protocol";
import type { RulesHost } from "../host";
import { enumerateAssignments, validateAssignment } from "../combat/assignment";
import { makeEnv } from "../effects/env";
import { groupSatisfied } from "../effects/group";
import { legalIntents } from "../view/legal";
import { whoMayAct } from "../view/who";
import { promptReason } from "../prompts/handlers";

/** The seeded PRNG used by tests, the harness and the live bot driver. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform index into a non-empty list. */
function randomIndex(random: () => number, length: number): number {
  const value = Math.floor(random() * length);
  return value < 0 ? 0 : value >= length ? length - 1 : value;
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const other = randomIndex(random, index + 1);
    const tmp = out[index]!;
    out[index] = out[other]!;
    out[other] = tmp;
  }
  return out;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

/** Bounds of an offer, clamped to the options actually presented (411.2). */
function optionBounds(prompt: Prompt, options: readonly PromptOption[]): { min: number; max: number } {
  const rawMin = Math.max(0, Math.trunc(prompt.min ?? 1));
  const rawMax = Math.max(rawMin, Math.trunc(prompt.max ?? options.length));
  const max = Math.min(rawMax, options.length);
  const min = Math.min(rawMin, max);
  return { min, max };
}

/** A random count in [min, max], preferring at least one option when the offer allows any. */
function chooseCount(min: number, max: number, random: () => number): number {
  if (max <= min) return min;
  if (min === 0 && max > 0) return 1 + randomIndex(random, max);
  return min + randomIndex(random, max - min + 1);
}

function pickOptions(
  options: readonly PromptOption[],
  min: number,
  max: number,
  random: () => number,
): string[] {
  const count = chooseCount(min, max, random);
  return shuffled(options, random)
    .slice(0, Math.min(count, options.length))
    .map((option) => option.id);
}

/** Group-aware subset choice: every returned subset satisfies `group` (355.11). */
function pickGroupOptions(
  room: Room,
  host: RulesHost | null,
  prompt: Prompt,
  options: readonly PromptOption[],
  group: SelectorGroupRequirement,
  min: number,
  max: number,
  random: () => number,
): string[] | null {
  if (!host) return null;
  const ctx = {
    room,
    host,
    env: makeEnv({ controller: prompt.playerId }),
  };
  const legal = (ids: readonly string[]) =>
    ids.length >= min && ids.length <= max && groupSatisfied(ctx, group, ids);

  // Small offers: enumerate exactly, then choose uniformly among the legal subsets (preferring
  // non-empty ones so an "up to N" group actually does something).
  if (options.length <= 12) {
    const found: string[][] = [];
    for (let mask = 0; mask < 1 << options.length; mask += 1) {
      const subset = options.filter((_, index) => (mask & (1 << index)) !== 0);
      if (!legal(subset.map((option) => option.id))) continue;
      found.push(subset.map((option) => option.id));
    }
    if (found.length === 0) return null;
    const nonEmpty = found.filter((ids) => ids.length > 0);
    const pool = nonEmpty.length > 0 ? nonEmpty : found;
    return pool[randomIndex(random, pool.length)]!;
  }

  // Larger offers: random attempts, then a greedy subset.
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const ids = pickOptions(options, min, Math.min(max, options.length), random);
    if (legal(ids)) return ids;
  }
  const greedy: string[] = [];
  for (const option of options) {
    const next = [...greedy, option.id];
    if (next.length <= max && groupSatisfied(ctx, group, next)) greedy.push(option.id);
  }
  return legal(greedy) ? greedy : null;
}

function yesNoAnswer(options: readonly PromptOption[]): PromptAnswer | null {
  if (options.length === 0) return {};
  const yes = options.find((option) => option.id === "yes");
  return { optionIds: [yes?.id ?? options[0]!.id] };
}

/** Map object/card ids offered by an effect decision back to the prompt option ids. */
function optionIdsForObjects(prompt: Prompt, ids: readonly string[]): string[] | null {
  const out: string[] = [];
  for (const id of ids) {
    const option = (prompt.options ?? []).find(
      (entry) => entry.id === id || entry.objectId === id || entry.cardId === id || entry.value === id,
    );
    if (!option) return null;
    out.push(option.id);
  }
  return out;
}

/** 355.14.e–g: a legal split share (every target at least 1, sum = total). */
function splitShareAnswer(ask: Record<string, unknown>): PromptAnswer | null {
  const total = typeof ask.total === "number" ? Math.trunc(ask.total) : 0;
  const targets = stringArray(ask.targets);
  const minEach = typeof ask.minEach === "number" ? Math.max(1, Math.trunc(ask.minEach)) : 1;
  if (targets.length === 0 || total < targets.length * minEach) return null;
  const shares = targets.map((targetId) => ({ targetId, amount: minEach }));
  shares[0]!.amount += total - targets.length * minEach;
  return { assignments: shares };
}

/** 467.2.c: the suggested assignment, or the first legal one the engine can enumerate. */
function damageAssignmentAnswer(prompt: Prompt): PromptAnswer | null {
  const data = record(prompt.data);
  if (!data || typeof data.total !== "number" || !Array.isArray(data.targets)) return null;
  const targets = data.targets as Array<{ objectId: string; lethal: number | null; tier: number }>;
  const total = Math.trunc(data.total);
  const suggested =
    Array.isArray(data.suggested) && data.suggested.length > 0
      ? (data.suggested as Array<{ targetId: string; amount: number }>)
      : undefined;
  const assignment =
    suggested && validateAssignment(targets, total, suggested).ok
      ? suggested
      : enumerateAssignments(targets, total, 1)[0];
  if (!assignment) return null;
  return { assignments: assignment };
}

/** `effects.resume` with `data.ask.answer === "objects"`: exact count, known subset or group. */
function objectDecisionAnswer(
  room: Room,
  host: RulesHost | null,
  prompt: Prompt,
  ask: Record<string, unknown>,
  random: () => number,
): PromptAnswer | null {
  const options = prompt.options ?? [];
  if (options.length === 0) return {};
  const rawMin = Math.max(0, Math.trunc(prompt.min ?? 1));
  if (rawMin > options.length) return null;
  const subsets = Array.isArray(ask.subsets) ? (ask.subsets as unknown[]).map(stringArray) : null;
  if (subsets && subsets.length > 0) {
    const chosen = subsets[randomIndex(random, subsets.length)]!;
    const ids = optionIdsForObjects(prompt, chosen);
    return ids ? { optionIds: ids } : null;
  }
  const exact = typeof ask.exact === "number" ? Math.max(0, Math.trunc(ask.exact)) : null;
  if (exact !== null && exact > options.length) return null;
  const group = record(ask.group) as SelectorGroupRequirement | null;
  const bounds = optionBounds(prompt, options);
  const min = exact ?? bounds.min;
  const max = exact ?? bounds.max;
  if (group) {
    const ids = pickGroupOptions(room, host, prompt, options, group, min, max, random);
    return ids ? { optionIds: ids } : null;
  }
  return { optionIds: pickOptions(options, min, max, random) };
}

/**
 * The full prompt-answer chooser. `host` is optional because the public
 * `pickPromptAnswer` signature has no host; group requirements can only be checked with it.
 */
function pickPromptAnswerInternal(
  prompt: Prompt,
  room: Room,
  host: RulesHost | null,
  random: () => number,
): PromptAnswer | null {
  const options = prompt.options ?? [];
  const data = record(prompt.data);
  const reason = promptReason(prompt);
  const ask = record(data?.ask);

  // 355.14: split-damage division (kind damage-assignment, reason effects.resume).
  if (ask && ask.answer === "split") return splitShareAnswer(ask);
  // 467.2.c: combat damage assignment.
  if (reason === "combat.damage_assignment") return damageAssignmentAnswer(prompt);
  // 371.2 / 372 / 373: replacement decisions. Prefer applying a replacement (or "yes").
  if (reason === "effects.replacement") {
    if (prompt.kind === "yes-no") return yesNoAnswer(options);
    if (prompt.kind === "choose-mode" && options.length > 0) {
      const applicable = options.filter((option) => option.id !== "$none");
      const pool = applicable.length > 0 ? applicable : options;
      return { optionIds: [pool[randomIndex(random, pool.length)]!.id] };
    }
  }
  if (ask && ask.answer === "objects") {
    return objectDecisionAnswer(room, host, prompt, ask, random);
  }
  // 383.3.d: any order is legal; listed ids first, unlisted follow in detection order.
  if (reason === "effects.order_triggers" || prompt.kind === "order") {
    return { orderedIds: shuffled(options, random).map((option) => option.id) };
  }
  if (prompt.kind === "choose-opponent") {
    if (options.length === 0) return {};
    const option = options[randomIndex(random, options.length)]!;
    const playerId = option.playerId ?? option.id;
    return { playerId };
  }
  if (prompt.kind === "yes-no") return yesNoAnswer(options);
  // 355.1 / 355.1.a: X can be 0; the smallest offer keeps the play affordable.
  if (prompt.kind === "choose-number") {
    if (options.length === 0) return {};
    return { optionIds: [options[0]!.id] };
  }

  if (options.length === 0) return {};
  if (Math.max(0, Math.trunc(prompt.min ?? 1)) > options.length) return null;
  const bounds = optionBounds(prompt, options);
  // 355.11 / 355.11.a: a play-time choice with a group requirement.
  const spec = record(data?.spec);
  const group =
    (record(data?.group) as SelectorGroupRequirement | null) ??
    (record(spec?.group) as SelectorGroupRequirement | null);
  if (group && host) {
    const ids = pickGroupOptions(room, host, prompt, options, group, bounds.min, bounds.max, random);
    if (ids) return { optionIds: ids };
  }
  return { optionIds: pickOptions(options, bounds.min, bounds.max, random) };
}

/**
 * The shared prompt answerer (411.2). `room` only supplies read-only facts for group
 * requirements; it must be the prompted player's redacted view in live play.
 */
export function pickPromptAnswer(
  prompt: Prompt,
  room: Room,
  random: () => number,
): PromptAnswer | null {
  return pickPromptAnswerInternal(prompt, room, null, random);
}

/** One legal intent for `playerId`, or `null` when the bot cannot act / has no answer. */
export function pickRandomAction(
  room: Room,
  playerId: string,
  host: RulesHost,
  random: () => number,
): RulesIntent | null {
  if (room.gameOutcome || !room.rules) return null;
  const who = whoMayAct(room);
  if (who.kind === "none" || who.player !== playerId) return null;
  const legal = legalIntents(room, playerId, host);

  // 411.2: a Limited-Action prompt takes precedence over every other action.
  if (legal.prompt) {
    const answer = pickPromptAnswerInternal(legal.prompt, room, host, random);
    if (!answer) return null;
    return { type: "rules_choose", promptId: legal.prompt.id, answer };
  }
  // §6.4: close the manual window before anything else so unscripted cards resolve.
  if (legal.canManualDone) return { type: "rules_manual_done" };

  const progress: RulesIntent[] = [];
  const details = legal.playable;
  if (details) {
    for (const detail of details) {
      const location =
        detail.locations.length > 0
          ? detail.locations[randomIndex(random, detail.locations.length)]
          : undefined;
      progress.push({
        type: "rules_play",
        cardId: detail.cardId,
        ...(location ? { location: location as ZoneSelector } : {}),
      });
    }
  } else {
    // Defensive: a host that omits the R2-play details still gets bare plays.
    for (const cardId of legal.playableCardIds) {
      progress.push({ type: "rules_play", cardId });
    }
  }
  for (const hide of legal.hideable ?? []) {
    const location = hide.locations[randomIndex(random, hide.locations.length)];
    if (!location) continue;
    progress.push({ type: "rules_play", cardId: hide.cardId, hide: true, location: location as ZoneSelector });
  }
  for (const activatable of legal.activatable) {
    progress.push({
      type: "rules_activate",
      objectId: activatable.objectId,
      ability: activatable.ability,
    });
  }
  for (const move of legal.moves) {
    progress.push({ type: "rules_move", unitIds: [...move.unitIds], to: move.to });
  }
  if (progress.length > 0) return progress[randomIndex(random, progress.length)]!;

  if (legal.canEndTurn) return { type: "rules_end_turn" };
  if (legal.canPass) return { type: "rules_pass" };
  return null;
}
