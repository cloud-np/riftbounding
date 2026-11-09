// R4 bot-room stand-in: replaced by the bot-core lane at integration
/**
 * Minimal random legal-action picker (R4 bot-room stand-in).
 *
 * The real `bot-core` implementation replaces this file; the shared surface is fixed:
 * `pickRandomAction`, `pickPromptAnswer` and `mulberry32`. Keep the module pure: it only reads
 * the room and takes randomness from the injected `random` function.
 */
import type { Prompt, PromptAnswer, Room, RulesIntent } from "@rift/protocol";
import { enumerateAssignments } from "../combat/assignment";
import type { RulesHost } from "../host";
import { legalIntents, whoMayAct } from "../view";

/** Seedable PRNG (mulberry32) for deterministic bot play/tests. */
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

/**
 * Build an answer for an open strict prompt, mirroring the property-test answerers:
 * no options → `{}`; damage assignment → `suggested` (or the first enumeration);
 * ordering → the offered order; default → the first `min`..`max` options.
 */
export function pickPromptAnswer(
  prompt: Prompt,
  room: Room,
  random: () => number,
): PromptAnswer | null {
  void random;
  const options = prompt.options ?? [];
  if (options.length === 0) return {};
  if (prompt.data?.reason === "combat.damage_assignment") {
    const data = prompt.data as {
      targets?: Parameters<typeof enumerateAssignments>[0];
      total?: number;
      suggested?: Array<{ targetId: string; amount: number }>;
    };
    if (Array.isArray(data.targets) && typeof data.total === "number") {
      const assignment = data.suggested ?? enumerateAssignments(data.targets, data.total, 1)[0];
      if (assignment) return { assignments: assignment };
    }
    return null;
  }
  if (prompt.kind === "order") {
    return { orderedIds: options.map((option) => option.id) };
  }
  if (prompt.kind === "choose-opponent") {
    const option = options[0];
    const playerId = option?.playerId ?? option?.id;
    return playerId ? { playerId } : null;
  }
  const min = Math.max(0, Math.trunc(prompt.min ?? 1));
  const max = Math.min(options.length, Math.max(min, Math.trunc(prompt.max ?? options.length)));
  const count = Math.min(options.length, Math.max(min, Math.min(1, max)));
  void room;
  return { optionIds: options.slice(0, count).map((option) => option.id) };
}

/**
 * The first legal progress action for `playerId`, else end-turn, then pass. Prompt answers and
 * the §6.4 manual window come first (an unscripted card otherwise stalls the game).
 */
export function pickRandomAction(
  room: Room,
  playerId: string,
  host: RulesHost,
  random: () => number,
): RulesIntent | null {
  void random;
  if (!room.rules || room.gameOutcome) return null;
  const who = whoMayAct(room);
  if (who.kind === "none" || who.player !== playerId) return null;
  const legal = legalIntents(room, playerId, host);
  if (legal.prompt) {
    const answer = pickPromptAnswer(legal.prompt, room, random);
    if (!answer) return null;
    return { type: "rules_choose", promptId: legal.prompt.id, answer };
  }
  if (legal.canManualDone) return { type: "rules_manual_done" };
  for (const cardId of legal.playableCardIds) {
    return { type: "rules_play", cardId };
  }
  for (const activatable of legal.activatable) {
    return { type: "rules_activate", objectId: activatable.objectId, ability: activatable.ability };
  }
  for (const move of legal.moves) {
    return { type: "rules_move", unitIds: [...move.unitIds], to: move.to };
  }
  if (legal.canEndTurn) return { type: "rules_end_turn" };
  if (legal.canPass) return { type: "rules_pass" };
  return null;
}
