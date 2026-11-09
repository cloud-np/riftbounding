/**
 * Spiritforged (SFD) card-test helpers (lane-local; shared helpers are imported read-only).
 */
import type {
  BattlefieldZone,
  CardInstance,
  GameEvent,
  Prompt,
  PromptAnswer,
} from "@rift/protocol";
import { expect } from "vitest";
import { getCardScript } from "../../../src";
import { scenario, type RulesScenario, type ScenarioInput } from "../../scenarios/dsl";
import { boardOf, fund, place, zoneOf } from "../../rules/effects/helpers";
import { damageData, setControl } from "../../rules/combat/helpers";
import { addPool, boardCard, hand, namesIn, withCards } from "../helpers";
export { addPool, boardCard, hand, namesIn, withCards };

export { boardOf, fund, place, zoneOf, setControl };

export type S = RulesScenario;

/** Put a card (hand/deck/trash) into a zone with an optional fixed id. */
export function put(
  s: S,
  playerId: string,
  name: string,
  zone: string,
  options: { exhausted?: boolean; id?: string } = {},
): CardInstance {
  return place(s, playerId, name, zone, options);
}

export type Answerer = (prompt: Prompt) => PromptAnswer | undefined;

/** Default answers: "yes", the first `min` options (at least one), suggested combat damage. */
export const defaultAnswer: Answerer = (prompt) => {
  if (prompt.kind === "damage-assignment") {
    const data = damageData({ rules: { prompt } } as never);
    return { assignments: data?.suggested ?? [] } as PromptAnswer;
  }
  const options = prompt.options ?? [];
  if (options.some((option) => option.id === "yes")) return { optionIds: ["yes"] };
  const count = Math.max(prompt.min ?? 1, 1);
  return { optionIds: options.slice(0, count).map((option) => option.id) };
};

/**
 * Pass Priority/Focus and answer prompts until nothing is left to resolve. `answer` may return
 * `undefined` to fall back to the default answer. Returns every event emitted on the way.
 */
export function settle(s: S, answer: Answerer = defaultAnswer, maxSteps = 40): GameEvent[] {
  const events: GameEvent[] = [];
  for (let index = 0; index < maxSteps; index += 1) {
    const rules = s.room.rules!;
    if (s.room.gameOutcome) break;
    if (rules.manual) break;
    if (rules.prompt) {
      const reply = answer(rules.prompt) ?? defaultAnswer(rules.prompt)!;
      s.as(rules.prompt.playerId).choose(reply).expectOk();
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

/**
 * Like `settle`, but stops as soon as the chain is empty (no showdown/combat is passed through),
 * so damage marked by a resolution can be read before any combat heals it.
 */
export function resolveChain(s: S, answer: Answerer = defaultAnswer, maxSteps = 40): GameEvent[] {
  const events: GameEvent[] = [];
  for (let index = 0; index < maxSteps; index += 1) {
    const rules = s.room.rules!;
    if (s.room.gameOutcome || rules.manual) break;
    if (rules.prompt) {
      const reply = answer(rules.prompt) ?? defaultAnswer(rules.prompt)!;
      s.as(rules.prompt.playerId).choose(reply).expectOk();
      events.push(...s.events());
      continue;
    }
    if (rules.chain.length === 0 || !rules.priority) break;
    s.as(rules.priority).pass().expectOk();
    events.push(...s.events());
  }
  return events;
}

/** Answer prompts in order: each entry is consumed by the next prompt it matches. */
export function answers(...queue: Array<(PromptAnswer & { kind?: string }) | string[]>): Answerer {
  const pending = [...queue];
  return (prompt) => {
    const next = pending[0];
    if (!next) return undefined;
    const entry = Array.isArray(next) ? { optionIds: next } : next;
    if (entry.kind && entry.kind !== prompt.kind) return undefined;
    pending.shift();
    const { kind: _kind, ...reply } = entry as PromptAnswer & { kind?: string };
    return reply as PromptAnswer;
  };
}

/** Play a card from hand with exact funding (+ extra resources) and explicit choices. */
export function playCard(
  s: S,
  playerId: string,
  name: string,
  options: {
    choices?: Record<string, unknown>;
    location?: string;
    optionalCosts?: string[];
    extraEnergy?: number;
    extraPower?: Record<string, number>;
    fund?: boolean;
  } = {},
): S {
  if (options.fund !== false) fund(s, playerId, name);
  if (options.extraEnergy || options.extraPower)
    addPool(s, playerId, options.extraEnergy ?? 0, options.extraPower ?? {});
  const card = s.handCard(playerId, name);
  if (!card) throw new Error(`playCard: ${name} not in ${playerId}'s hand`);
  return s.as(playerId).apply({
    type: "rules_play",
    cardId: card.id,
    // Explicit `[]` keeps the pre-prompt behaviour for existing card tests (355.1.a).
    optionalCosts: options.optionalCosts ?? [],
    ...(options.choices ? { choices: options.choices as never } : {}),
    ...(options.location ? { location: options.location as never } : {}),
  } as never);
}

export function countNamed(s: S, playerId: string, zone: string, name: string): number {
  return namesIn(s, playerId, zone).filter((entry) => entry === name).length;
}

/** Move a named card (hand/deck/trash) to the top of its owner's Main Deck (the draw end). */
export function onTop(s: S, playerId: string, name: string): CardInstance {
  const board = boardOf(s, playerId);
  for (const pool of [board.hand, board.deck, board.trash]) {
    const index = pool.findIndex((card) => card.name === name);
    if (index < 0) continue;
    const [card] = pool.splice(index, 1);
    board.deck.push(card!);
    return card!;
  }
  throw new Error(`onTop: ${name} not found for ${playerId}`);
}

/**
 * Kill a unit at a battlefield with a real spell: `killer` plays Drag Under (it must be among
 * that player's extra cards) and both players pass (429, Deathknell 808).
 */
export function killWithSpell(s: S, unitId: string, killer = "p1"): GameEvent[] {
  if (!s.handCard(killer, "Drag Under")) s.moveDeckCardToHand(killer, "Drag Under");
  playCard(s, killer, "Drag Under", { choices: { "target:0": unitId } }).expectOk();
  return settle(s);
}

export function damageOf(s: S, id: string): number {
  return s.room.rules!.objects[id]?.damage ?? 0;
}

/** The registered status of a card script. */
export function statusOf(name: string): string | undefined {
  return getCardScript(name)?.status;
}

/**
 * p2 holds `zone` with `defenders`; p1 moves `attacker` (placed at its base, ready) in and the
 * combat opens (190.3.a.1 / 466). Returns the placed cards.
 */
export function attack(
  s: S,
  attacker: string,
  defenders: string[],
  zone: BattlefieldZone = "battlefieldA",
): { attacker: CardInstance; defenders: CardInstance[] } {
  const placed = defenders.map((name) => put(s, "p2", name, zone));
  setControl(s.room, zone, "p2");
  const unit = put(s, "p1", attacker, "base");
  s.as("p1").move(attacker, zone).expectOk();
  return { attacker: unit, defenders: placed };
}

export function expectZone(s: S, id: string, zone: string | null): void {
  expect(zoneOf(s, id)).toBe(zone);
}
