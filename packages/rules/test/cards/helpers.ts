/**
 * Shared card-test helpers (maintainability review G10). Lane helper modules
 * (`test/cards/<lane>/helpers.ts`) re-export these and keep only helpers whose semantics are
 * lane-specific (their `settle` / `answer` variants answer prompts differently).
 */
import type { CardInstance, RulesDomain } from "@rift/protocol";
import { scenario, type RulesScenario, type ScenarioInput } from "../scenarios/dsl";
import { boardOf } from "../rules/effects/helpers";

export type S = RulesScenario;

/**
 * A scenario whose players hold the named cards: extra copies are appended to the decks and
 * moved to hand (duplicates in the list mean several copies).
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

/** Both players pass priority, `first` first. */
export function passBoth(s: S, first = "p1"): void {
  s.as(first).pass().expectOk();
  s.as(first === "p1" ? "p2" : "p1")
    .pass()
    .expectOk();
}

/**
 * Pass until nothing is pending (empty chain, no showdown or combat), a prompt appears, or
 * nobody holds priority / focus.
 */
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

/** Card names in one of a player's zones. */
export function namesIn(s: S, player: string, zone: string): string[] {
  const board = boardOf(s, player) as unknown as Record<string, CardInstance[] | undefined>;
  return (board[zone] ?? []).map((card) => card.name);
}

export function handNames(s: S, player: string): string[] {
  return boardOf(s, player).hand.map((card) => card.name);
}

export function hand(s: S, player: string): CardInstance[] {
  return boardOf(s, player).hand;
}

/** The `index`-th card with this name on the player's board (base, battlefields, legend, runes). */
export function boardCard(s: S, player: string, name: string, index = 0): CardInstance | undefined {
  const board = boardOf(s, player) as unknown as Record<string, CardInstance[] | undefined>;
  const found: CardInstance[] = [];
  for (const zone of ["base", "battlefieldA", "battlefieldB", "battlefieldC", "legend", "runeArea"]) {
    for (const card of board[zone] ?? []) if (card.name === name) found.push(card);
  }
  return found[index];
}

/** Add Energy / Power to a player's rune pool. */
export function addPool(s: S, playerId: string, energy: number, power: Partial<Record<RulesDomain | "any", number>> = {}): void {
  const pool = s.room.rules!.pools[playerId]!;
  pool.energy += energy;
  for (const [domain, value] of Object.entries(power)) {
    const key = domain as RulesDomain | "any";
    pool.power = { ...pool.power, [key]: (pool.power[key] ?? 0) + (value ?? 0) };
  }
}
