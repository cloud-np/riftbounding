/**
 * Derived turn state and turn order — rules 303–313.
 *
 * `turnState(room)` is always derived from the chain and the showdown, never stored (308–310).
 */
import type { Room, TurnState } from "@rift/protocol";
import type { RulesHost } from "../host";

/* ---------------------------------------------------------------- derived state (307–310) */

export function chainExists(room: Room): boolean {
  return (room.rules?.chain.length ?? 0) > 0;
}

export function showdownActive(room: Room): boolean {
  const rules = room.rules;
  return !!rules && (rules.showdown !== null || rules.combat !== null);
}

/** 307–310: Neutral/Showdown × Open/Closed. */
export function turnState(room: Room): TurnState {
  const showdown = showdownActive(room);
  const closed = chainExists(room);
  if (showdown) return closed ? "showdown_closed" : "showdown_open";
  return closed ? "neutral_closed" : "neutral_open";
}

/** 312: at most one player has priority. */
export function priorityHolder(room: Room): string | null {
  return room.rules?.priority ?? null;
}

/** 313.5: no focus in a Neutral State. */
export function focusHolder(room: Room): string | null {
  return room.rules?.focus ?? null;
}

export function isTurnPlayer(room: Room, playerId: string): boolean {
  return !!room.rules && room.rules.turn.player === playerId;
}

/* ---------------------------------------------------------------- turn order helpers */

export function activePlayerIds(room: Room, host: RulesHost): string[] {
  return host.activePlayerIds(room);
}

/** 303.2.a: turn order starting with the current turn player. */
export function turnOrderStartingAt(room: Room, playerId: string, host: RulesHost): string[] {
  const order = host.turnOrder(room);
  if (order.length === 0) return [];
  const index = order.indexOf(playerId);
  if (index < 0) return [...order];
  return [...order.slice(index), ...order.slice(0, index)];
}

/** Next player in the looping turn order (312.2.d / 347.2.b). */
export function nextPlayerInTurnOrder(room: Room, playerId: string, host: RulesHost): string | null {
  const order = host.turnOrder(room);
  if (order.length === 0) return null;
  const index = order.indexOf(playerId);
  // 303.2.a: a player outside the recorded turn order starts at the top of the order instead
  // of silently skipping the first player (the old `Math.max(0, -1) + 1` bug).
  if (index < 0) return order[0] ?? null;
  const next = order[(index + 1) % order.length];
  return next ?? null;
}
