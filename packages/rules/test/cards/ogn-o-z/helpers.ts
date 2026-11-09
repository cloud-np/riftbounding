/**
 * Helpers for the Origins O–Z card-script suites (wave R3, lane `ogn-oz`). Read-only use of the
 * shared scenario DSL and R2-effects helpers; nothing here changes engine behaviour.
 */
import type { CardInstance } from "@rift/protocol";
import { scenario } from "../../scenarios/dsl";
import { boardOf, fund, place } from "../../rules/effects/helpers";

export type S = ReturnType<typeof scenario>;

/** A scenario whose extra cards are moved into each player's hand (they sit on top of the deck). */
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

/** Both players pass once (`first` passes first). */
export function passBoth(s: S, first = "p1"): void {
  s.as(first).pass().expectOk();
  s.as(first === "p1" ? "p2" : "p1")
    .pass()
    .expectOk();
}

/**
 * Pass priority/focus until the chain is empty and no showdown or combat is open, or a prompt
 * opens (bounded).
 */
export function resolveAll(s: S, guard = 16): void {
  for (let index = 0; index < guard; index += 1) {
    const rules = s.room.rules!;
    if (rules.prompt) return;
    if (rules.chain.length === 0 && !rules.showdown && !rules.combat) return;
    const who = rules.priority ?? rules.focus;
    if (!who) return;
    s.as(who).pass().expectOk();
  }
}

/** Pass until the named card's item has left the chain (or a prompt opens). */
export function resolveItem(s: S, cardName: string, guard = 12): void {
  for (let index = 0; index < guard; index += 1) {
    const rules = s.room.rules!;
    if (rules.prompt) return;
    if (!rules.chain.some((item) => item.cardName === cardName)) return;
    const who = rules.priority;
    if (!who) return;
    s.as(who).pass().expectOk();
  }
}

/** Fund and play a card from hand for `player`; the opponent passes so it resolves. */
export function playAndResolve(
  s: S,
  player: string,
  name: string,
  options: { choices?: Record<string, unknown>; location?: string } = {},
): void {
  fund(s, player, name);
  s.as(player).play(name, options).expectOk();
}

/** Put a legend card (added through `extraCards`) into the player's legend zone. */
export function placeLegend(s: S, player: string, name: string): CardInstance {
  const board = boardOf(s, player) as unknown as Record<string, CardInstance[]>;
  board.legend!.splice(0, board.legend!.length);
  return place(s, player, name, "legend");
}

export function handNames(s: S, player: string): string[] {
  return boardOf(s, player).hand.map((card) => card.name);
}

export function setMight(
  s: S,
  id: string,
  might: number,
  extra: Record<string, unknown> = {},
): void {
  s.room.rules!.objects[id] = { ...(s.room.rules!.objects[id] ?? {}), baseMight: might, ...extra };
}

/** A card on `player`'s board (base, battlefields, legend) by name. */
export function boardCard(s: S, player: string, name: string, index = 0): CardInstance | undefined {
  const board = boardOf(s, player) as unknown as Record<string, CardInstance[] | undefined>;
  const found: CardInstance[] = [];
  for (const zone of ["base", "battlefieldA", "battlefieldB", "battlefieldC", "legend"]) {
    for (const card of board[zone] ?? []) if (card.name === name) found.push(card);
  }
  return found[index];
}
