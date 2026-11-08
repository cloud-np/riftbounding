/**
 * R2-combat test helpers (combat 461–468, cleanups 318–324, scoring 469–474, victory).
 *
 * Only builds on public `@rift/rules` exports, the scenario DSL and the real engine host.
 */
import type {
  BattlefieldZone,
  CardInstance,
  CombatDamageAssignmentData,
  GameEvent,
  GameVariant,
  Room,
  RulesIntent,
} from "@rift/protocol";
import {
  applyRulesIntent,
  initializeStrictRules,
  type RulesContext,
  type RulesHost,
  type RulesStepContext,
} from "../../../src";
import { createInitialGameState } from "../../../../engine/src/index";
import { createEngineRulesHost } from "../../../../engine/src/strict/host";
import { deterministicContext, type RulesScenario } from "../../scenarios/dsl";
import { loadFixtureDecks, withExtraCards, type ExtraDeckCards } from "../../fixtures/decks";
import { putCardAt } from "../../scenarios/cleanup-helpers";

export { boardOf, putCardAt, readyUnit, stepOf } from "../../scenarios/cleanup-helpers";

/** Put a printed unit (from hand/deck/trash) at `zone`, ready, with an optional fixed id. */
export function placeUnit(
  s: RulesScenario,
  playerId: string,
  name: string,
  zone: BattlefieldZone | "base",
  id?: string,
): CardInstance {
  return putCardAt(s, playerId, name, zone, id);
}

/** 190.2: store a battlefield's control explicitly (null = Uncontrolled). */
export function setControl(room: Room, zone: BattlefieldZone, playerId: string | null): void {
  const rules = room.rules!;
  rules.objects[zone] = { ...(rules.objects[zone] ?? {}), controller: playerId };
}

export function controllerOf(room: Room, zone: BattlefieldZone): string | null | undefined {
  return room.rules?.objects[zone]?.controller;
}

export function eventTypes(events: readonly GameEvent[]): string[] {
  return events.map((event) => event.type);
}

export function damageData(room: Room): CombatDamageAssignmentData | null {
  const prompt = room.rules?.prompt;
  if (!prompt || prompt.kind !== "damage-assignment") return null;
  return prompt.data as unknown as CombatDamageAssignmentData;
}

/**
 * Pass Focus/Priority with whoever holds it until no showdown/chain needs a pass. A pending
 * damage-assignment prompt is answered with its suggested assignment unless `stopAtPrompt`.
 * Returns every event emitted on the way.
 */
export function passUntilSettled(
  s: RulesScenario,
  options: { stopAtPrompt?: boolean; maxSteps?: number } = {},
): GameEvent[] {
  const events: GameEvent[] = [];
  for (let index = 0; index < (options.maxSteps ?? 20); index += 1) {
    const rules = s.room.rules!;
    if (s.room.gameOutcome) break;
    if (rules.prompt) {
      if (options.stopAtPrompt || rules.prompt.kind !== "damage-assignment") break;
      const data = damageData(s.room)!;
      s.as(rules.prompt.playerId).choose({ assignments: data.suggested ?? [] }).expectOk();
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

/* ---------------------------------------------------------------- multi-player tables */

export interface Table {
  room: Room;
  ctx: RulesContext;
  host: RulesHost;
  apply(actor: string, intent: RulesIntent): { ok: boolean; code?: string; rule?: string; events: GameEvent[] };
  step(): RulesStepContext;
  board(playerId: string): NonNullable<Room["players"][number]["board"]>;
  place(playerId: string, name: string, zone: BattlefieldZone | "base", id?: string): CardInstance;
}

/**
 * A real 3- or 4-player strict room at Main Phase (the scenario DSL builds duels only).
 * `p1` is the first player and Turn Player. Extra printed cards can be appended to decks.
 */
export function table(
  variant: GameVariant,
  options: { extra?: Partial<Record<string, readonly string[]>>; teams?: Record<string, string> } = {},
): Table {
  const decks = loadFixtureDecks();
  const ctx = deterministicContext(777_000 + variant.length);
  const count = variant === "free_for_all_3" ? 3 : variant === "duel" ? 2 : 4;
  const ids = ["p1", "p2", "p3", "p4"].slice(0, count);
  const room = createInitialGameState({
    roomCode: `RULES-COMBAT-${variant}`,
    createdAt: ctx.now,
    phase: "in_game",
    gameVariant: variant,
    roomMode: "multiplayer",
    shuffleDecks: false,
    players: ids.map((id, index) => {
      const base = index === 0 ? decks.deckA : decks.deckB;
      const extra: ExtraDeckCards = { p1: options.extra?.[id] ?? [] };
      const deck = withExtraCards({ deckA: base, deckB: base }, extra).deckA;
      return { id, name: `Player ${index + 1}`, submittedDeck: { sections: deck.sections, raw: deck.raw } };
    }),
  });
  if (options.teams) room.teamIdByPlayerId = options.teams;
  room.rulesMode = "strict";
  room.firstPlayerId = "p1";
  room.turnNumber = 1;
  room.activeTurnPlayerId = "p1";
  // A battlefield without a Victory Score modifier (Aspirant's Climb would add 1, 194.3.a).
  for (const player of room.players) player.selectedBattlefield = "Bandle Tree";
  const host = createEngineRulesHost(ctx);
  const t: Table = {
    room: initializeStrictRules(room, ctx, host),
    ctx,
    host,
    apply(actor, intent) {
      const result = applyRulesIntent(t.room, actor, intent, ctx, host);
      if (result.ok) {
        t.room = result.room;
        return { ok: true, events: result.events };
      }
      return { ok: false, code: result.code, rule: result.rule, events: [] };
    },
    step() {
      return { ctx, host, events: [] };
    },
    board(playerId) {
      const board = t.room.players.find((player) => player.id === playerId)?.board;
      if (!board) throw new Error(`no board for ${playerId}`);
      return board;
    },
    place(playerId, name, zone, id) {
      const board = t.board(playerId);
      for (const pool of [board.hand, board.deck, board.trash]) {
        const index = pool.findIndex((card) => card.name === name);
        if (index < 0) continue;
        const [found] = pool.splice(index, 1);
        const card: CardInstance = { ...found!, ...(id ? { id } : {}), exhausted: false };
        (board as unknown as Record<string, CardInstance[]>)[zone]!.push(card);
        return card;
      }
      throw new Error(`card ${name} not found for ${playerId}`);
    },
  };
  return t;
}
