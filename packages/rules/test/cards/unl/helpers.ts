/**
 * Unleashed (UNL) card-test helpers (lane-local; the shared DSL and effect helpers are imported
 * read-only).
 */
import { expect } from "vitest";
import type { CardInstance } from "@rift/protocol";
import { scenario } from "../../scenarios/dsl";
import { boardOf } from "../../rules/effects/helpers";

export type S = ReturnType<typeof scenario>;

/** A scenario whose players hold the named extra cards in hand (extra cards may already be there). */
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

/** Both players pass Priority once (the first one listed passes first). */
export function passBoth(s: S, first = "p1"): void {
  s.as(first).pass().expectOk();
  s.as(first === "p1" ? "p2" : "p1")
    .pass()
    .expectOk();
}

/**
 * Pass Priority until the chain is empty. Fails when a prompt opens (answer it in the test), so a
 * test never answers a decision by accident.
 */
export function resolveChain(s: S, guard = 12): void {
  for (
    let step = 0;
    step < guard && (s.room.rules!.chain.length > 0 || s.room.rules!.priority);
    step += 1
  ) {
    expect(
      s.room.rules!.prompt ?? null,
      `unexpected prompt ${s.room.rules!.prompt?.kind}`,
    ).toBeNull();
    if (s.room.rules!.chain.length === 0) break;
    const holder = s.room.rules!.priority;
    if (!holder) break;
    s.as(holder).pass().expectOk();
  }
}

export function hand(s: S, player: string): CardInstance[] {
  return boardOf(s, player).hand;
}

export function cardsNamed(s: S, player: string, zone: string, name: string): CardInstance[] {
  const board = boardOf(s, player) as unknown as Record<string, CardInstance[] | undefined>;
  return (board[zone] ?? []).filter((card) => card.name === name);
}

/** Answer the pending prompt with option ids (or a yes/no). */
export function answer(s: S, optionIds: string[]): void {
  const prompt = s.room.rules!.prompt;
  expect(prompt, "no prompt is pending").toBeTruthy();
  s.as(prompt!.playerId).choose({ optionIds }).expectOk();
}
