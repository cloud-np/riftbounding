/**
 * R2-effects test helpers (kept out of the shared DSL/generators, lane discipline).
 */
import type { CardInstance, CardScript, Effect, GameEvent, Room } from "@rift/protocol";
import { executeEffect, registerCardScript, type RulesStepContext } from "../../../src";
import type { RulesScenario } from "../../scenarios/dsl";

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
  for (const script of scripts) registerCardScript(script);
}

export function eventTypes(events: GameEvent[]): string[] {
  return events.map((event) => event.type);
}

export function objectOf(room: Room, id: string) {
  return room.rules?.objects[id];
}
