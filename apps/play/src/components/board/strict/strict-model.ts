/**
 * Strict-rules board model (R2-int) — pure helpers behind the strict panel and prompt dialogs.
 *
 * Everything here reads the (per-viewer redacted) `Room` and the `@rift/rules` read side through
 * `@rift/engine`'s strict view; nothing here applies an action. Sandbox rooms never reach these
 * helpers (`isStrictRoom` is false), so the original board is untouched.
 */
import type {
  CardInstance,
  CombatDamageAssignmentData,
  CombatDamageTarget,
  GameState,
  Prompt,
  PromptAnswer,
  PromptOption,
  WhoMayAct,
  WireAction,
} from "@rift/protocol";
import { promptTitle, type Translator } from "@rift/i18n";

export function isStrictRoom(room: GameState | null | undefined): boolean {
  return !!room && room.rulesMode === "strict" && room.phase === "in_game" && !!room.rules;
}

/**
 * The left strict-rules panel is developer-only (owner: "not relevant for PROD"). Reuse the
 * app's existing Next `NODE_ENV` convention: `next dev` / tests enable it, a production build
 * (`next build`/`next start`) hides it. Everything the panel offered in production has a board
 * control elsewhere (chain A/S, End turn, leave/concede, prompt dialog, ambiguity chooser).
 */
export function strictRulesPanelEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Find a visible card by id anywhere on the (redacted) board or the chain display. */
export function findCard(room: GameState, cardId: string): CardInstance | null {
  for (const player of room.players) {
    const board = player.board as unknown as Record<string, unknown> | undefined;
    if (!board) continue;
    for (const value of Object.values(board)) {
      if (!Array.isArray(value)) continue;
      const card = (value as CardInstance[]).find((entry) => entry?.id === cardId);
      if (card) return card;
    }
  }
  return room.chainEntries.find((entry) => entry.card.id === cardId)?.card ?? null;
}

export function cardName(room: GameState, cardId: string): string {
  const card = findCard(room, cardId);
  return card?.name || cardId;
}

export function playerName(room: GameState, playerId: string): string {
  return room.players.find((player) => player.id === playerId)?.name || playerId;
}

const ZONE_KEYS: Record<string, string> = {
  base: "sim.base",
  battlefieldA: "sim.tablet.battlefieldA",
  battlefieldB: "sim.tablet.battlefieldB",
  battlefieldC: "sim.tablet.battlefieldC",
};

export function zoneLabel(t: Translator, zone: string): string {
  const key = ZONE_KEYS[zone];
  return (key ? t(key) : null) ?? zone;
}

/**
 * The seat this client acts as in a strict room: the seat that may act now when this client
 * controls it (solo lab / practice control both seats), otherwise the viewer's own seat.
 */
export function strictActorFor(
  who: WhoMayAct | null,
  viewerId: string,
  controlledPlayerIds: readonly string[],
): string {
  if (who && who.kind !== "none" && controlledPlayerIds.includes(who.player)) return who.player;
  return viewerId;
}

/* ------------------------------------------------------------------ status line */

/** "You have priority" / "Bob has focus" / "Waiting for Bob: <prompt title>". */
export function strictStatus(
  room: GameState,
  who: WhoMayAct | null,
  controlledPlayerIds: readonly string[],
  t: Translator,
  promptTitleText: string | null,
): string | null {
  if (!who || who.kind === "none") return null;
  const name = playerName(room, who.player);
  const mine = controlledPlayerIds.includes(who.player);
  if (who.kind === "prompt") {
    if (mine) return promptTitleText;
    return t("rules.ui.waitingForChoice", { player: name, reason: promptTitleText ?? "" }) ?? name;
  }
  if (who.kind === "manual") {
    const card = room.rules?.manual?.cardName ?? "";
    return mine
      ? (t("rules.ui.manualWindow", { card }) ?? card)
      : (t("rules.ui.manualWindowOther", { player: name, card }) ?? card);
  }
  if (who.kind === "focus") return t("rules.ui.focusOf", { player: name }) ?? name;
  return mine
    ? (t("rules.ui.yourPriority") ?? "")
    : (t("rules.ui.priorityOf", { player: name }) ?? name);
}

/** A board prompt's instruction: the card's own prompt key, else the kind-specific instruction. */
export function promptInstruction(t: Translator, prompt: Prompt): string {
  if (prompt.kind === "choose-target") {
    return t("rules.prompt.chooseTarget") ?? promptTitle(t, prompt);
  }
  if (prompt.kind === "choose-card") {
    return t("rules.prompt.choose") ?? promptTitle(t, prompt);
  }
  if (prompt.kind === "choose-battlefield") {
    return t("rules.prompt.chooseDestination") ?? promptTitle(t, prompt);
  }
  return promptTitle(t, prompt);
}

/** The source card name of a pending play/trigger prompt (e.g. "Sand Soldier"). */
export function promptSourceName(room: GameState, prompt: Prompt): string | null {
  const item = prompt.sourceItemId
    ? room.rules?.chain.find((entry) => entry.id === prompt.sourceItemId)
    : undefined;
  return item?.cardName ?? item?.sourceName ?? null;
}

/** Where the aiming arrow starts: the chain item's card/entry or a source board object. */
export function promptSourceAnchor(
  room: GameState,
  prompt: Prompt,
): { id: string; anchor: "board" | "chain" } | null {
  const item = prompt.sourceItemId
    ? room.rules?.chain.find((entry) => entry.id === prompt.sourceItemId)
    : undefined;
  if (item) return { id: item.id, anchor: "chain" };
  const source = prompt.data?.sourceObjectId;
  return typeof source === "string" && source.length > 0
    ? { id: source, anchor: "board" }
    : null;
}

/**
 * Strict chain-lane status. Unlike the sandbox vote counter this never claims a player has
 * priority while the rules engine is waiting for a prompt: that player must choose first.
 */
export function strictChainStatus(
  room: GameState,
  who: WhoMayAct | null,
  controlledPlayerIds: readonly string[],
  t: Translator,
  prompt: Prompt | null,
): string | null {
  if (!who || who.kind === "none") return null;
  const name = playerName(room, who.player);
  if (who.kind === "prompt") {
    const reason = prompt ? promptInstruction(t, prompt) : null;
    return (
      t("rules.ui.mustChoose", { player: name, reason: reason ?? "" }) ??
      `${name} must choose${reason ? `: ${reason}` : ""}`
    );
  }
  if (who.kind === "manual") {
    const card = room.rules?.manual?.cardName ?? "";
    return controlledPlayerIds.includes(who.player)
      ? (t("rules.ui.manualWindow", { card }) ?? card)
      : (t("rules.ui.manualWindowOther", { player: name, card }) ?? card);
  }
  if (who.kind === "focus") {
    return controlledPlayerIds.includes(who.player)
      ? (t("rules.ui.focusOf", { player: name }) ?? name)
      : (t("rules.ui.waitingForFocus", { player: name }) ?? `Waiting for ${name} (focus)`);
  }
  return controlledPlayerIds.includes(who.player)
    ? (t("rules.ui.priorityOf", { player: name }) ?? `${name} has priority`)
    : (t("rules.ui.waitingForPriority", { player: name }) ?? `Waiting for ${name} (priority)`);
}

/* ------------------------------------------------------------------ prompts (411.2) */

/** The pending prompt when one of this client's seats must answer it, else null. */
export function promptForClient(
  room: GameState,
  controlledPlayerIds: readonly string[],
): Prompt | null {
  const prompt = room.rules?.prompt ?? null;
  if (!prompt || !controlledPlayerIds.includes(prompt.playerId)) return null;
  return prompt;
}

export function optionLabel(room: GameState, t: Translator, option: PromptOption): string {
  if (option.label) return option.label;
  if (option.cardId) return cardName(room, option.cardId);
  if (option.objectId) return cardName(room, option.objectId);
  if (option.playerId) return playerName(room, option.playerId);
  if (option.zone) return zoneLabel(t, option.zone);
  if (option.value !== undefined) return String(option.value);
  return option.id;
}

export function selectionBounds(prompt: Prompt): { min: number; max: number } {
  const count = (prompt.options ?? []).filter((option) => !option.disabled).length;
  const min = prompt.min ?? 1;
  const max = prompt.max ?? count;
  return { min: Math.max(0, min), max: Math.max(0, max) };
}

/** 411.2: an option answer is legal when the number selected is within `min`..`max`. */
export function canSubmitSelection(prompt: Prompt, selected: readonly string[]): boolean {
  const { min, max } = selectionBounds(prompt);
  const offered = new Set((prompt.options ?? []).filter((o) => !o.disabled).map((o) => o.id));
  if (!selected.every((id) => offered.has(id))) return false;
  if (prompt.kind === "order") return selected.length === offered.size;
  return selected.length >= min && selected.length <= max;
}

/** `rules_choose` answer for an option prompt; ordering prompts send the order too (383.3.d). */
export function selectionAnswer(prompt: Prompt, selected: readonly string[]): PromptAnswer {
  const optionIds = [...selected];
  return prompt.kind === "order" ? { optionIds, orderedIds: optionIds } : { optionIds };
}

export function chooseIntent(prompt: Prompt, answer: PromptAnswer, applyToSimilar = false): WireAction {
  // Auto-pass "yes to all" (docs/rules/auto-pass.md): the rules layer remembers the answer.
  return { type: "rules_choose", promptId: prompt.id, answer, ...(applyToSimilar ? { applyToSimilar: true } : {}) };
}

/** Toggle an option in a selection; a single-choice prompt replaces the selection. */
export function toggleSelection(prompt: Prompt, selected: readonly string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((entry) => entry !== id);
  const { max } = selectionBounds(prompt);
  if (prompt.kind !== "order" && max === 1) return [id];
  if (prompt.kind !== "order" && selected.length >= max) return [...selected];
  return [...selected, id];
}

/* ------------------------------------------------------------------ 467.2.c damage assignment */

export function damageAssignmentData(prompt: Prompt): CombatDamageAssignmentData | null {
  const data = prompt.data as Partial<CombatDamageAssignmentData> | undefined;
  if (prompt.kind !== "damage-assignment" || !data || data.reason !== "combat.damage_assignment") {
    return null;
  }
  if (typeof data.total !== "number" || !Array.isArray(data.targets)) return null;
  return data as CombatDamageAssignmentData;
}

export type AssignmentDraft = Record<string, number>;

/** Pre-fill with the engine's suggestion (467.2.c.3 greedy order), else zeros. */
export function initialAssignment(data: CombatDamageAssignmentData): AssignmentDraft {
  const draft: AssignmentDraft = {};
  for (const target of data.targets) draft[target.objectId] = 0;
  for (const entry of data.suggested ?? []) {
    if (entry.targetId in draft) draft[entry.targetId] = Math.max(0, entry.amount);
  }
  return draft;
}

export function assignedTotal(draft: AssignmentDraft): number {
  return Object.values(draft).reduce((sum, value) => sum + value, 0);
}

export function remainingDamage(data: CombatDamageAssignmentData, draft: AssignmentDraft): number {
  return data.total - assignedTotal(draft);
}

/** Step one target by `delta`, never below 0 or past the total. */
export function stepAssignment(
  data: CombatDamageAssignmentData,
  draft: AssignmentDraft,
  target: CombatDamageTarget,
  delta: number,
): AssignmentDraft {
  const current = draft[target.objectId] ?? 0;
  const room = remainingDamage(data, draft);
  const next = Math.max(0, Math.min(current + delta, current + room));
  return { ...draft, [target.objectId]: next };
}

/**
 * Client-side gate only (the engine's `damageAssignmentVerdict` decides 467.2.c legality and
 * explains a rejection): every point is assigned.
 */
export function canSubmitAssignment(
  data: CombatDamageAssignmentData,
  draft: AssignmentDraft,
): boolean {
  return remainingDamage(data, draft) === 0;
}

export function assignmentAnswer(draft: AssignmentDraft): PromptAnswer {
  return {
    assignments: Object.entries(draft)
      .filter(([, amount]) => amount > 0)
      .map(([targetId, amount]) => ({ targetId, amount })),
  };
}
