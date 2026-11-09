/**
 * Helpers for the Vendetta / Proving Grounds card tests (ven-ogs lane). Built on the shared
 * scenario DSL and R2-effects helpers, which are imported read-only.
 */
import type {
  CardInstance,
  CombatDamageAssignmentData,
  GameEvent,
  RulesDomain,
} from "@rift/protocol";
import { effectiveKeywordValues, effectiveKeywords, effectiveMight } from "../../../src";
import { scenario } from "../../scenarios/dsl";
import { boardOf, place } from "../../rules/effects/helpers";
import { addPool, passBoth, withCards } from "../helpers";
export { addPool, passBoth, withCards };

export type S = ReturnType<typeof scenario>;

/** Activate an ability of a board object (ref = `activated:<index in abilities>`). */
export function activate(
  s: S,
  playerId: string,
  card: CardInstance,
  ref: string,
  choices?: Record<string, unknown>,
): S {
  return s.as(playerId).apply({
    type: "rules_activate",
    objectId: card.id,
    ability: ref,
    ...(choices ? { choices: choices as never } : {}),
  });
}

/** Resolve the chain: pass priority / answer nothing until it is empty (no prompts expected). */
export function resolveAll(s: S, guard = 12): void {
  for (let step = 0; step < guard && s.room.rules!.chain.length > 0; step += 1) {
    if (s.room.rules!.prompt) return;
    s.as(s.room.rules!.priority!).pass().expectOk();
  }
}

export function might(s: S, id: string): number {
  return effectiveMight(s.room, id, s.host);
}

export function keywords(s: S, id: string): string[] {
  return effectiveKeywords(s.room, id, s.host);
}

export function keywordValue(s: S, id: string, keyword: string): number {
  return effectiveKeywordValues(s.room, id, s.host)[keyword.toLowerCase()] ?? 0;
}

export function empowered(s: S, id: string): boolean {
  return (s.room.rules!.objects[id]?.empowered ?? 0) > 0;
}

/** Number of runes in a player's Rune Area. */
export function runeCount(s: S, playerId: string): number {
  return boardOf(s, playerId).runeArea.length;
}

/** Put runes from the Rune Deck into the Rune Area until the player controls `n` runes. */
export function setRunes(s: S, playerId: string, n: number): void {
  const board = boardOf(s, playerId);
  while (board.runeArea.length > n) board.runeDeck.push(board.runeArea.pop()!);
  while (board.runeArea.length < n && board.runeDeck.length > 0)
    board.runeArea.push({ ...board.runeDeck.shift()!, exhausted: false });
}

/** Exhaust every rune a player controls (so payments come from the Rune Pool only). */
export function exhaustRunes(s: S, playerId: string): void {
  for (const rune of boardOf(s, playerId).runeArea) rune.exhausted = true;
}

/** Answer the pending prompt with the given option ids (or the first `n` options). */
export function answer(s: S, ids: string[] | number = 1): void {
  const prompt = s.room.rules!.prompt;
  if (!prompt) throw new Error("answer: no prompt");
  const optionIds =
    typeof ids === "number" ? prompt.options!.slice(0, ids).map((option) => option.id) : ids;
  s.as(prompt.playerId).choose({ optionIds }).expectOk();
}

export function zoneOf(s: S, id: string): string | null {
  return s.host.findCard(s.room, id)?.zone ?? null;
}

/**
 * Pass until the chain and any showdown/combat are settled; damage-assignment prompts take the
 * suggested assignment; stops at any other prompt. Returns the events seen.
 */
export function settle(s: S, maxSteps = 30): GameEvent[] {
  const events: GameEvent[] = [];
  for (let index = 0; index < maxSteps; index += 1) {
    const rules = s.room.rules!;
    if (s.room.gameOutcome) break;
    if (rules.prompt) {
      if (rules.prompt.kind === "order") {
        // 383.3.d: keep the offered order.
        s.as(rules.prompt.playerId)
          .choose({ orderedIds: (rules.prompt.options ?? []).map((option) => option.id) })
          .expectOk();
        events.push(...s.events());
        continue;
      }
      if (rules.prompt.kind !== "damage-assignment") break;
      const data = rules.prompt.data as unknown as CombatDamageAssignmentData;
      s.as(rules.prompt.playerId)
        .choose({ assignments: data.suggested ?? [] })
        .expectOk();
      events.push(...s.events());
      continue;
    }
    const actor = rules.chain.length > 0 ? rules.priority : rules.showdown ? rules.focus : null;
    if (!actor) break;
    s.as(actor).pass().expectOk();
    events.push(...s.events());
  }
  return events;
}

/** 190.2: store a battlefield's control explicitly (null = Uncontrolled). */
export function setControl(s: S, zone: string, playerId: string | null): void {
  const rules = s.room.rules!;
  rules.objects[zone] = { ...(rules.objects[zone] ?? {}), controller: playerId };
}

export { place, boardOf };
