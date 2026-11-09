/**
 * R2-effects test helpers (kept out of the shared DSL/generators, lane discipline).
 */
import type { CardInstance, CardScript, Effect, GameEvent, Room } from "@rift/protocol";
import { executeEffect, type RulesStepContext } from "../../../src";
import type { RulesScenario } from "../../scenarios/dsl";
import { registerTestCardScript } from "../../../src/testing";

export function stepFor(s: RulesScenario, events: GameEvent[] = []): RulesStepContext {
  return { ctx: s.ctx, host: s.host, events };
}

export function boardOf(s: RulesScenario, playerId: string) {
  const board = s.room.players.find((player) => player.id === playerId)?.board;
  if (!board) throw new Error(`no board for ${playerId}`);
  return board;
}

/**
 * Put a card (from deck, hand or trash) into a zone without any game action. Returns the card
 * (ready unless `exhausted`).
 */
export function place(
  s: RulesScenario,
  playerId: string,
  name: string,
  zone: string,
  options: { exhausted?: boolean; id?: string } = {},
): CardInstance {
  const board = boardOf(s, playerId) as unknown as Record<string, CardInstance[]>;
  let found: CardInstance | undefined;
  for (const pool of [board.deck!, board.hand!, board.trash!, board.champion!]) {
    const index = pool.findIndex((card) => card.name === name);
    if (index >= 0) {
      [found] = pool.splice(index, 1);
      break;
    }
  }
  if (!found) throw new Error(`place: ${name} not found for ${playerId}`);
  const card: CardInstance = { ...found, ...(options.id ? { id: options.id } : {}), exhausted: options.exhausted ?? false };
  const list = board[zone];
  if (!list) throw new Error(`place: unknown zone ${zone}`);
  list.push(card);
  return card;
}

export function zoneNames(s: RulesScenario, playerId: string, zone: string): string[] {
  const board = boardOf(s, playerId) as unknown as Record<string, CardInstance[]>;
  return (board[zone] ?? []).map((card) => card.name);
}

export function zoneOf(s: RulesScenario, cardId: string): string | null {
  return s.host.findCard(s.room, cardId)?.zone ?? null;
}

/** Execute an effect directly on the scenario room (draft) and return its events. */
export function run(
  s: RulesScenario,
  effect: Effect,
  options: { controller?: string; source?: string; choices?: Record<string, unknown>; event?: GameEvent } = {},
): { status: string; events: GameEvent[] } {
  const step = stepFor(s);
  const result = executeEffect(effect, {
    room: s.room,
    step,
    controller: options.controller ?? "p1",
    ...(options.source ? { sourceObjectId: options.source } : {}),
    choices: options.choices ?? {},
    ...(options.event ? { event: options.event } : {}),
  });
  return { status: result.status, events: step.events };
}

export function spell(name: string, effect: Effect, text = "test spell"): CardScript {
  return { name, text, status: "implemented", abilities: [{ kind: "spell", effect }] };
}

export function registerAll(scripts: CardScript[]): void {
  for (const script of scripts) registerTestCardScript(script);
}

export function eventTypes(events: GameEvent[]): string[] {
  return events.map((event) => event.type);
}

export function objectOf(room: Room, id: string) {
  return room.rules?.objects[id];
}

/**
 * Fund plays exactly (357.1, 131): add each named card's printed Energy cost and Power cost
 * (as Power of the card's first Domain, 135.2.e.6) to the player's Rune Pool, read from the
 * catalog through `host.cardInfo`. The card must be in the player's hand or on the board. Payment
 * still runs through R2-play's planner; this only provides the resources a real player would
 * have channeled.
 */
export function fund(s: RulesScenario, playerId: string, ...names: string[]): void {
  const pool = s.room.rules?.pools[playerId];
  if (!pool) throw new Error(`fund: no pool for ${playerId}`);
  const board = boardOf(s, playerId) as unknown as Record<string, CardInstance[] | undefined>;
  const used = new Set<string>();
  for (const name of names) {
    let card: CardInstance | undefined;
    for (const zone of ["hand", "base", "battlefieldA", "battlefieldB", "battlefieldC", "champion", "legend", "deck"]) {
      card = (board[zone] ?? []).find((entry) => entry.name === name && !used.has(entry.id));
      if (card) break;
    }
    if (!card) throw new Error(`fund: ${name} not found for ${playerId}`);
    used.add(card.id);
    const info = s.host.cardInfo(s.room, card.id);
    pool.energy += info?.energyCost ?? 0;
    const power = info?.powerCost ?? 0;
    if (power > 0) {
      const domain = (info?.domains?.[0] ?? "any") as keyof typeof pool.power;
      pool.power = { ...pool.power, [domain]: (pool.power[domain] ?? 0) + power };
    }
  }
}
