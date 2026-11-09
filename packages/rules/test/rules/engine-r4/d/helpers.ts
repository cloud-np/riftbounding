/**
 * Lane D (R4-engine) test helpers — attachments: Equip 818, Quick-Draw 819,
 * Weaponmaster 821, Deploy 830, attached Effect Text 718–719.
 *
 * Uses the shared scenario DSL and effects helpers read-only; only lane-D tests live here.
 */
import type { CardInstance, GameEvent } from "@rift/protocol";
import { expect } from "vitest";
import { scenario, type RulesScenario, type ScenarioInput } from "../../../scenarios/dsl";
import { boardOf, place } from "../../effects/helpers";

export type S = RulesScenario;

export { boardOf, place };

/** A scenario whose named cards are in hand (extra deck cards, then drawn). */
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

/** A scenario with the named cards left in the decks (use `put` to place them). */
export function withDeck(p1: string[], p2: string[] = [], extra: ScenarioInput = {}): S {
  return scenario({ ...extra, extraCards: { p1, p2 } });
}

/** Put a card (hand/deck/trash) into a zone without a game action. */
export function put(
  s: S,
  playerId: string,
  name: string,
  zone: string,
  options: { exhausted?: boolean; id?: string } = {},
): CardInstance {
  return place(s, playerId, name, zone, options);
}

/** Add Energy/Power to a player's Rune Pool (a real player would have channeled it). */
export function addPool(s: S, playerId: string, energy: number, power: Record<string, number> = {}): void {
  const pool = s.room.rules!.pools[playerId]!;
  pool.energy += energy;
  for (const [domain, count] of Object.entries(power)) {
    pool.power = {
      ...pool.power,
      [domain]: ((pool.power as Record<string, number>)[domain] ?? 0) + count,
    };
  }
}

/** A board card of `playerId` by name (any board zone). */
export function boardCard(
  s: S,
  playerId: string,
  name: string,
  index = 0,
): CardInstance | undefined {
  const board = boardOf(s, playerId) as unknown as Record<string, CardInstance[] | undefined>;
  const found: CardInstance[] = [];
  for (const zone of [
    "base",
    "battlefieldA",
    "battlefieldB",
    "battlefieldC",
    "legend",
    "runeArea",
  ]) {
    for (const card of board[zone] ?? []) if (card.name === name) found.push(card);
  }
  return found[index];
}

/**
 * Pass Priority/Focus and answer prompts until nothing is left to resolve. Prompts are answered
 * with "yes" when offered (403.1) and otherwise with the first `min` options (at least one).
 */
export function settle(s: S, maxSteps = 40): GameEvent[] {
  const events: GameEvent[] = [];
  for (let index = 0; index < maxSteps; index += 1) {
    const rules = s.room.rules!;
    if (s.room.gameOutcome || rules.manual) break;
    if (rules.prompt) {
      const prompt = rules.prompt;
      const options = prompt.options ?? [];
      const optionIds = options.some((option) => option.id === "yes")
        ? ["yes"]
        : options.slice(0, Math.max(prompt.min ?? 1, 1)).map((option) => option.id);
      s.as(prompt.playerId).choose({ optionIds } as never).expectOk();
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

/** Pass through chains and showdowns until the state is quiet (no prompt answering). */
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

export function expectZone(s: S, cardId: string, zone: string | null): void {
  expect(s.host.findCard(s.room, cardId)?.zone ?? null).toBe(zone);
}
