/**
 * R2-play test helpers (kept out of the shared DSL so the three R2 branches merge cleanly).
 */
import type { CardInstance } from "@rift/protocol";
import type { RulesStepContext } from "../../../src/types";
import { scenario, type RulesScenario, type ScenarioInput } from "../../scenarios/dsl";

export type RuneSpec = { domain: "Calm" | "Chaos"; exhausted?: boolean };

/** Board of a player (throws when missing). */
export function boardOf(s: RulesScenario, playerId: string) {
  const board = s.room.players.find((player) => player.id === playerId)?.board;
  if (!board) throw new Error(`no board for ${playerId}`);
  return board;
}

/**
 * Replace a player's rune area with exactly `specs` (fixture decks hold 6 Calm + 6 Chaos runes).
 * Returns the rune ids in `specs` order.
 */
export function setRunes(s: RulesScenario, playerId: string, specs: RuneSpec[]): string[] {
  const board = boardOf(s, playerId);
  board.runeDeck.push(...board.runeArea.map((rune) => ({ ...rune, exhausted: false })));
  board.runeArea = [];
  const ids: string[] = [];
  for (const spec of specs) {
    const index = board.runeDeck.findIndex((rune) => rune.name === `${spec.domain} Rune`);
    if (index < 0) throw new Error(`setRunes: no ${spec.domain} Rune left in ${playerId}'s rune deck`);
    const [rune] = board.runeDeck.splice(index, 1) as [CardInstance];
    board.runeArea.push({ ...rune, exhausted: spec.exhausted === true });
    ids.push(rune.id);
  }
  return ids;
}

export function setPool(
  s: RulesScenario,
  playerId: string,
  energy: number,
  power: Partial<Record<string, number>> = {},
): void {
  if (!s.room.rules) throw new Error("no rules state");
  s.room.rules.pools[playerId] = { energy, power: { ...power } };
}

export function pool(s: RulesScenario, playerId: string) {
  return s.room.rules?.pools[playerId] ?? { energy: 0, power: {} };
}

export function runeState(s: RulesScenario, playerId: string, id: string): "ready" | "exhausted" | "deck" | "gone" {
  const board = boardOf(s, playerId);
  const onBoard = board.runeArea.find((rune) => rune.id === id);
  if (onBoard) return onBoard.exhausted ? "exhausted" : "ready";
  if (board.runeDeck.some((rune) => rune.id === id)) return "deck";
  return "gone";
}

/** A step context bound to the scenario's host/ctx (for direct draft-mutator tests). */
export function stepOf(s: RulesScenario): RulesStepContext {
  return { ctx: s.ctx, host: s.host, events: [] };
}

/** Scenario with an empty pool and no runes for both players (fully controlled resources). */
export function bareScenario(input: ScenarioInput = {}): RulesScenario {
  const s = scenario(input);
  setRunes(s, "p1", []);
  setRunes(s, "p2", []);
  setPool(s, "p1", input.p1?.energy ?? 0, input.p1?.power ?? {});
  setPool(s, "p2", input.p2?.energy ?? 0, input.p2?.power ?? {});
  return s;
}

/** Place a card from a player's deck into a zone and return the placed instance. */
export function place(s: RulesScenario, playerId: string, name: string, zone: string): CardInstance {
  s.placeFromDeck(playerId, name, zone);
  const list = (boardOf(s, playerId) as unknown as Record<string, CardInstance[]>)[zone] ?? [];
  const card = [...list].reverse().find((entry) => entry.name === name);
  if (!card) throw new Error(`place: ${name} not placed`);
  return card;
}

/** Move a deck card into hand and return it. */
export function toHand(s: RulesScenario, playerId: string, name: string): CardInstance {
  s.moveDeckCardToHand(playerId, name);
  const card = [...boardOf(s, playerId).hand].reverse().find((entry) => entry.name === name);
  if (!card) throw new Error(`toHand: ${name} not in hand`);
  return card;
}
