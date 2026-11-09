/**
 * Strict-rules board helpers (R4-gestures client side).
 *
 * The ENGINE owns the gesture → `rules_*` mapping (`packages/engine/src/strict/gestures.ts`).
 * This module only contains what the board still needs in strict rooms:
 *
 * - the read-side `legalIntents` view for highlighting playable cards / prompt options;
 * - natural gesture payloads that are not built by `drop-intents.ts` (tapping a card);
 * - prompt-click helpers: object prompts are answered by clicking the board, multi-selection
 *   prompts accumulate clicks and send one `rules_choose` on confirm.
 *
 * It deliberately does NOT build `rules_play` / `rules_activate` / `rules_move` intents.
 */
import { strictLegalIntents } from "@rift/engine";
import type {
  LegalIntents,
  Prompt,
  PromptOption,
  Room,
  RulesChooseIntent,
  WireAction,
  Zone,
} from "@rift/protocol";

import { findCard, isStrictRoom } from "./strict-model";

/** 411.2 prompts whose options are board objects/zones: a board click can answer them. */
export const OBJECT_PROMPT_KINDS: ReadonlySet<string> = new Set([
  "choose-target",
  "choose-card",
  "choose-battlefield",
]);

const BOARD_ZONES: ReadonlySet<string> = new Set([
  "base",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
]);

/** The strict read side, indexed for board highlighting. */
export interface StrictBoardView {
  actorId: string;
  legal: LegalIntents;
  playableCardIds: ReadonlySet<string>;
  activatableById: ReadonlyMap<string, readonly string[]>;
  moves: LegalIntents["moves"];
}

export function strictViewFromLegal(actorId: string, legal: LegalIntents): StrictBoardView {
  const activatableById = new Map<string, string[]>();
  for (const entry of legal.activatable) {
    const list = activatableById.get(entry.objectId) ?? [];
    if (!list.includes(entry.ability)) list.push(entry.ability);
    activatableById.set(entry.objectId, list);
  }
  return {
    actorId,
    legal,
    playableCardIds: new Set(legal.playableCardIds),
    activatableById,
    moves: legal.moves,
  };
}

/** `legalIntents` for one seat, or null outside a strict in-game room. */
export function strictViewFor(
  room: Room | null | undefined,
  actorId: string,
): StrictBoardView | null {
  if (!isStrictRoom(room)) return null;
  const legal = strictLegalIntents(room, actorId);
  return legal ? strictViewFromLegal(actorId, legal) : null;
}

/** True when the §6.4 manual window is open for `actorId` (sandbox board actions stay legal). */
export function strictManualWindowFor(room: Room | null | undefined, actorId: string): boolean {
  return !!room?.rules?.manual && room.rules.manual.player === actorId;
}

/* ------------------------------------------------------------------ natural gestures */

export interface StrictUseOptions {
  ability?: string;
  targetCardId?: string;
}

/** "Use" a ready board object: `toggle_exhausted { …, expectedExhausted:false }` (engine maps it). */
export function strictUseGesture(
  zone: Zone,
  cardId: string,
  options: StrictUseOptions = {},
): WireAction {
  return {
    type: "toggle_exhausted",
    zone,
    cardId,
    expectedExhausted: false,
    ...(options.ability ? { ability: options.ability } : {}),
    ...(options.targetCardId ? { targetCardId: options.targetCardId } : {}),
  };
}

/** Resend a gesture with the ability chosen from an `ambiguous_gesture` rejection. */
export function withGestureAbility(
  gesture: WireAction,
  ability: string,
): WireAction {
  const record = gesture as unknown as Record<string, unknown>;
  const targetId = record.targetCardId ?? record.targetObjectId;
  // The engine reads `ability` on toggle_exhausted / equip_card only. A board-object drag is a
  // `move_card`; turn the chosen ability into the equivalent use gesture at the source zone.
  if (record.type === "move_card" && record.from && record.cardId && targetId) {
    return {
      type: "toggle_exhausted",
      zone: record.from,
      cardId: record.cardId,
      expectedExhausted: false,
      targetCardId: targetId,
      ability,
    } as WireAction;
  }
  return { ...gesture, ability } as WireAction;
}

export function strictPassIntent(): WireAction {
  return { type: "rules_pass" };
}

export function strictEndTurnIntent(): WireAction {
  return { type: "rules_end_turn" };
}

/* ------------------------------------------------------------------ prompts (411.2) */

export function promptIsObjectPrompt(prompt: Prompt): boolean {
  return OBJECT_PROMPT_KINDS.has(prompt.kind);
}

/** The prompt's options expanded to every id/alias a board card or zone can match. */
export function promptOptionMatchIds(prompt: Prompt): Set<string> {
  const ids = new Set<string>();
  for (const option of prompt.options ?? []) {
    if (option.disabled) continue;
    for (const id of [option.id, option.cardId, option.objectId, option.zone]) {
      if (typeof id === "string" && id.length > 0) ids.add(id);
    }
  }
  return ids;
}

/** True when at least one option is a visible board card or a board zone. */
export function promptHasBoardTargets(room: Room, prompt: Prompt): boolean {
  if (!promptIsObjectPrompt(prompt)) return false;
  for (const option of prompt.options ?? []) {
    if (option.disabled) continue;
    if (option.zone && BOARD_ZONES.has(option.zone)) return true;
    for (const id of [option.cardId, option.objectId, option.id]) {
      if (typeof id === "string" && id.length > 0) {
        if (findCard(room, id) || BOARD_ZONES.has(id)) return true;
      }
    }
  }
  return false;
}

/** The object/zone ids a gesture names, most specific first (mirrors the engine contract). */
export function gestureObjectIds(action: object): string[] {
  const record = action as Record<string, unknown>;
  const ids: string[] = [];
  const add = (value: unknown) => {
    if (typeof value === "string" && value.length > 0 && !ids.includes(value)) ids.push(value);
  };
  add(record.targetCardId);
  add(record.targetObjectId);
  switch (record.type) {
    case "toggle_exhausted":
      add(record.cardId);
      add(record.zone);
      break;
    case "move_card":
      add(record.cardId);
      add(record.to);
      break;
    case "chain_add":
      add(record.cardId);
      break;
    case "equip_card":
      add(record.unitCardId);
      add(record.equipmentCardId);
      break;
    default:
      if (Array.isArray(record.cardIds)) for (const id of record.cardIds) add(id);
      break;
  }
  return ids;
}

function optionMatches(option: PromptOption, id: string): boolean {
  return option.id === id || option.objectId === id || option.cardId === id || option.zone === id;
}

/** The prompt option named by a board gesture, or null. */
export function promptOptionForAction(
  prompt: Prompt,
  action: object,
): PromptOption | null {
  const ids = gestureObjectIds(action);
  if (ids.length === 0) return null;
  const options = (prompt.options ?? []).filter((option) => !option.disabled);
  for (const id of ids) {
    const option = options.find((entry) => optionMatches(entry, id));
    if (option) return option;
  }
  return null;
}

/** 811.1.b: the legal Hide drop zones for the card currently being dragged. */
export function hideDropZones(
  hideable: readonly { cardId: string; locations: readonly string[] }[] | undefined,
  draggedCardId: string | null | undefined,
): ReadonlySet<string> {
  if (!draggedCardId || !hideable) return new Set<string>();
  const entry = hideable.find((candidate) => candidate.cardId === draggedCardId);
  return new Set(entry?.locations ?? []);
}

/** `min`/`max` > one selection: clicks accumulate locally and one `rules_choose` is sent. */
export function promptNeedsAccumulation(prompt: Prompt): boolean {
  const count = (prompt.options ?? []).filter((option) => !option.disabled).length;
  return (prompt.max ?? count) > 1;
}

export function promptSelectionBounds(prompt: Prompt): { min: number; max: number } {
  const count = (prompt.options ?? []).filter((option) => !option.disabled).length;
  return {
    min: Math.max(0, prompt.min ?? 1),
    max: Math.max(0, prompt.max ?? count),
  };
}

export function togglePromptSelection(
  prompt: Prompt,
  selected: readonly string[],
  optionId: string,
): string[] {
  if (selected.includes(optionId)) return selected.filter((id) => id !== optionId);
  const { max } = promptSelectionBounds(prompt);
  if (max === 1) return [optionId];
  if (selected.length >= max) return [...selected];
  return [...selected, optionId];
}

export function canConfirmPromptSelection(prompt: Prompt, selected: readonly string[]): boolean {
  const { min, max } = promptSelectionBounds(prompt);
  const offered = new Set((prompt.options ?? []).filter((option) => !option.disabled).map((option) => option.id));
  return (
    selected.length >= min &&
    selected.length <= max &&
    selected.every((id) => offered.has(id))
  );
}

export function promptChooseIntent(
  prompt: Prompt,
  optionIds: readonly string[],
): RulesChooseIntent {
  return { type: "rules_choose", promptId: prompt.id, answer: { optionIds: [...optionIds] } };
}

/* ------------------------------------------------------------------ ambiguous gesture */

export interface AmbiguousGestureChoice {
  kind: "ability" | "mode";
  values: string[];
}

/** Parse the engine's `ambiguous_gesture` detail (`abilities: a, b` / `mode: m1, m2`). */
export function parseAmbiguousDetail(detail: string | undefined): AmbiguousGestureChoice | null {
  const text = (detail ?? "").trim();
  const split = (prefix: string): AmbiguousGestureChoice | null => {
    if (!text.startsWith(prefix)) return null;
    const values = text
      .slice(prefix.length)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    return values.length > 0
      ? { kind: prefix.startsWith("mode") ? "mode" : "ability", values }
      : null;
  };
  return split("abilities:") ?? split("mode:");
}
