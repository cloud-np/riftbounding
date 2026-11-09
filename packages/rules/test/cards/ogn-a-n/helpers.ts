/**
 * Wave R3 test helpers for the Origins A–N card scripts (lane-local; shared helpers are imported
 * read-only).
 */
import { expect } from "vitest";
import type { CardInstance, PromptAnswer } from "@rift/protocol";
import { scenario, type RulesScenario, type ScenarioInput } from "../../scenarios/dsl";
import { boardOf } from "../../rules/effects/helpers";

export type S = RulesScenario;

/**
 * A scenario with extra Main Deck cards moved to the players' hands (one copy per entry). Extra
 * cards sit on top of the deck and may already be in the opening hand.
 */
export function withCards(p1: string[], p2: string[] = [], extra: ScenarioInput = {}): S {
  const s = scenario({ ...extra, extraCards: { p1, p2 } });
  for (const [player, names] of [
    ["p1", p1],
    ["p2", p2],
  ] as const) {
    const wanted: Record<string, number> = {};
    for (const name of names) wanted[name] = (wanted[name] ?? 0) + 1;
    for (const [name, count] of Object.entries(wanted)) {
      const inHand = boardOf(s, player).hand.filter((card) => card.name === name).length;
      for (let index = inHand; index < count; index += 1) s.moveDeckCardToHand(player, name);
    }
  }
  return s;
}

/** Both players pass once (resolves the newest chain item when nobody responds). */
export function passBoth(s: S, first = "p1"): void {
  s.as(first).pass().expectOk();
  s.as(first === "p1" ? "p2" : "p1")
    .pass()
    .expectOk();
}

/**
 * Pass Priority with whoever holds it until the chain is empty, stopping at the first prompt (the
 * caller answers it and calls `drain` again). Returns the pending prompt, if any.
 */
export function drain(s: S, maxSteps = 12) {
  for (let index = 0; index < maxSteps; index += 1) {
    const rules = s.room.rules!;
    if (rules.prompt || s.room.gameOutcome) break;
    if (rules.chain.length === 0) break;
    const who = rules.priority;
    if (!who) break;
    s.as(who).pass().expectOk();
  }
  return s.room.rules!.prompt ?? null;
}

/**
 * Pass with whoever holds Priority (or Focus, during a Showdown) until `until` holds, a prompt
 * opens or nobody may pass. Returns the pending prompt, if any.
 */
export function settle(s: S, until: () => boolean = () => false, maxSteps = 16) {
  for (let index = 0; index < maxSteps; index += 1) {
    const rules = s.room.rules!;
    if (until() || rules.prompt || s.room.gameOutcome) break;
    if (rules.chain.length === 0 && !rules.showdown && !rules.combat) break;
    const actor = rules.priority ?? rules.focus;
    if (!actor) break;
    s.as(actor).pass().expectOk();
  }
  return s.room.rules!.prompt ?? null;
}

/** Answer the pending prompt as its player. */
export function answer(s: S, value: PromptAnswer): void {
  const prompt = s.room.rules!.prompt;
  expect(prompt, "no prompt is pending").toBeTruthy();
  s.as(prompt!.playerId).choose(value).expectOk();
}

/** Answer the pending prompt with object/option ids. */
export function pick(s: S, ...ids: string[]): void {
  answer(s, { optionIds: ids });
}

/** The ids offered by the pending prompt. */
export function promptOptions(s: S): string[] {
  return (s.room.rules!.prompt?.options ?? []).map((option) => option.id);
}

/** A card currently in a player's zone, by name. */
export function cardIn(
  s: S,
  playerId: string,
  zone: string,
  name: string,
): CardInstance | undefined {
  const board = boardOf(s, playerId) as unknown as Record<string, CardInstance[] | undefined>;
  return (board[zone] ?? []).find((card) => card.name === name);
}

/** Move a named card from a player's deck/hand to their trash (test setup only). */
export function toTrash(s: S, playerId: string, name: string): CardInstance {
  const board = boardOf(s, playerId);
  for (const pool of [board.deck, board.hand]) {
    const index = pool.findIndex((card) => card.name === name);
    if (index >= 0) {
      const [card] = pool.splice(index, 1);
      board.trash.push(card!);
      return card!;
    }
  }
  throw new Error(`toTrash: ${name} not found for ${playerId}`);
}

/** Put the player's whole hand back on the deck bottom except the named cards (test setup only). */
export function handOnly(s: S, playerId: string, keep: string[]): void {
  const board = boardOf(s, playerId);
  const kept: CardInstance[] = [];
  const rest: CardInstance[] = [];
  const wanted = [...keep];
  for (const card of board.hand) {
    const index = wanted.indexOf(card.name);
    if (index >= 0) {
      wanted.splice(index, 1);
      kept.push(card);
    } else rest.push(card);
  }
  board.hand.splice(0, board.hand.length, ...kept);
  board.deck.push(...rest);
}
