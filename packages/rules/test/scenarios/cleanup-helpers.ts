/**
 * Shared helpers for the R1-FIX-B cleanup / combat / expiration tests.
 *
 * These helpers only manipulate the already-built strict scenario through public primitives;
 * they never import from `.orchestrator` (reviewer probes are reproduced as real tests here).
 */
import type { BattlefieldZone, CardInstance, GameEvent } from "@rift/protocol";
import type { RulesStepContext } from "../../src";
import type { RulesScenario } from "./dsl";

/** Fresh step context for direct rule-helper calls. */
export function stepOf(s: RulesScenario, events: GameEvent[] = []): RulesStepContext {
  return { ctx: s.ctx, host: s.host, events };
}

/** Units enter exhausted (143.4); tests that move them call this first. */
export function readyUnit(s: RulesScenario, name: string): CardInstance {
  const unit = s.findBoardCard(name);
  if (!unit) throw new Error(`unit ${name} is not on the board`);
  unit.exhausted = false;
  return unit;
}

export function boardOf(s: RulesScenario, playerId: string) {
  const board = s.room.players.find((player) => player.id === playerId)?.board;
  if (!board) throw new Error(`player ${playerId} has no board`);
  return board;
}

/**
 * Move a card from a player's deck/hand directly onto a zone, mirroring an effect that puts a
 * Unit somewhere without going through the normal play process (190.4 / 323.8 set-ups).
 */
export function putCardAt(
  s: RulesScenario,
  playerId: string,
  name: string,
  zone: BattlefieldZone | "base" | "hand" | "trash",
  id?: string,
): CardInstance {
  const board = boardOf(s, playerId);
  const pools = [board.hand, board.deck, board.trash] as CardInstance[][];
  let found: CardInstance | undefined;
  for (const pool of pools) {
    const index = pool.findIndex((card) => card.name === name);
    if (index >= 0) {
      [found] = pool.splice(index, 1);
      break;
    }
  }
  if (!found) throw new Error(`card ${name} not found for ${playerId}`);
  const card: CardInstance = { ...found, ...(id ? { id } : {}), exhausted: false };
  const list = (board as unknown as Record<string, CardInstance[]>)[zone];
  if (!list) throw new Error(`unknown zone ${zone}`);
  list.push(card);
  return card;
}
