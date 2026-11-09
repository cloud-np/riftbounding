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

export { boardOf, fund, place, zoneOf, setControl };

export type S = RulesScenario;

/** A duel whose players have the named printed cards in hand (extra deck cards, then drawn). */
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

/** Add resources to a player's Rune Pool (a real player would have channeled them). */
export function addPool(
  s: S,
  playerId: string,
  energy: number,
  power: Record<string, number> = {},
): void {
  const pool = s.room.rules!.pools[playerId]!;
  pool.energy += energy;
  for (const [domain, count] of Object.entries(power)) {
    pool.power = {
      ...pool.power,
      [domain]: ((pool.power as Record<string, number>)[domain] ?? 0) + count,
    };
  }
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
    ...(options.choices ? { choices: options.choices as never } : {}),
    ...(options.location ? { location: options.location as never } : {}),
    ...(options.optionalCosts ? { optionalCosts: options.optionalCosts } : {}),
  } as never);
}

export function hand(s: S, playerId: string): CardInstance[] {
  return boardOf(s, playerId).hand;
}

export function namesIn(s: S, playerId: string, zone: string): string[] {
  return ((boardOf(s, playerId) as unknown as Record<string, CardInstance[]>)[zone] ?? []).map(
    (card) => card.name,
  );
}

export function countNamed(s: S, playerId: string, zone: string, name: string): number {
  return namesIn(s, playerId, zone).filter((entry) => entry === name).length;
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
