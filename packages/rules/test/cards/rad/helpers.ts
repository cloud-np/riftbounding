/**
 * RAD lane test helpers (read-only use of the shared scenario DSL and effects helpers).
 */
import { expect } from "vitest";
import type { CardInstance } from "@rift/protocol";
import { scenario, type RulesScenario } from "../../scenarios/dsl";
import { boardOf, place } from "../../rules/effects/helpers";

export type S = RulesScenario;

/** A scenario whose extra cards are in the players' hands (they start on top of the deck). */
export function withCards(
  p1: string[],
  p2: string[] = [],
  extra: Parameters<typeof scenario>[0] = {},
): S {
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

/** A scenario with extra cards left in the decks (use `place` to put them on the board). */
export function withDeck(
  p1: string[],
  p2: string[] = [],
  extra: Parameters<typeof scenario>[0] = {},
): S {
  return scenario({ ...extra, extraCards: { p1, p2 } });
}

export function passBoth(s: S, first = "p1"): void {
  s.as(first).pass().expectOk();
  s.as(first === "p1" ? "p2" : "p1")
    .pass()
    .expectOk();
}

/** Pass with whoever holds Priority until the chain is empty or a prompt opens. */
export function settle(s: S, guard = 12): void {
  for (let index = 0; index < guard; index += 1) {
    const rules = s.room.rules!;
    if (rules.prompt) return;
    if (rules.chain.length === 0) return;
    const holder = rules.priority;
    if (!holder) return;
    s.as(holder).pass().expectOk();
  }
}

/**
 * Pass priority/focus while work is outstanding, including Pending triggers that the chain
 * helpers do not flush (e.g. delayed "next unit" triggers). Stops at a prompt.
 */
export function flushWork(s: S, guard = 24): void {
  for (let index = 0; index < guard; index += 1) {
    const rules = s.room.rules!;
    if (rules.prompt) return;
    if (
      rules.chain.length === 0 &&
      rules.triggers.length === 0 &&
      !rules.showdown &&
      !rules.combat
    )
      return;
    const holder = rules.priority ?? rules.focus;
    if (!holder) return;
    s.as(holder).pass().expectOk();
  }
}

/** Pass through chains and showdowns (no prompts answered) until the state is Neutral Open. */
export function resolveAll(s: S, guard = 20): void {
  for (let index = 0; index < guard; index += 1) {
    const rules = s.room.rules!;
    if (rules.prompt) return;
    if (rules.chain.length === 0 && !rules.showdown && !rules.combat) return;
    const holder = rules.priority ?? rules.focus;
    if (!holder) return;
    s.as(holder).pass().expectOk();
  }
}

/** Answer the pending prompt with option ids (or a yes/no). */
export function answer(s: S, ids: string[] | "yes" | "no"): void {
  const prompt = s.room.rules!.prompt;
  expect(prompt, "no prompt is pending").toBeTruthy();
  const optionIds = ids === "yes" || ids === "no" ? [ids] : ids;
  s.as(prompt!.playerId).choose({ optionIds }).expectOk();
}

/** Put a hand/deck card of `player` on the board at `zone` (no game action). */
export function put(
  s: S,
  player: string,
  name: string,
  zone: string,
  exhausted = false,
): CardInstance {
  return place(s, player, name, zone, { exhausted });
}

export function handNames(s: S, player: string): string[] {
  return boardOf(s, player).hand.map((card) => card.name);
}

export function namesIn(s: S, player: string, zone: string): string[] {
  const board = boardOf(s, player) as unknown as Record<string, CardInstance[] | undefined>;
  return (board[zone] ?? []).map((card) => card.name);
}

export function pool(s: S, player: string) {
  return s.room.rules!.pools[player]!;
}

/** Empty a player's Rune Pool (fund exactly afterwards). */
export function drain(s: S, player: string): void {
  s.room.rules!.pools[player] = { energy: 0, power: {} };
}
