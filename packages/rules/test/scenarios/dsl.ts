/**
 * Scenario DSL v1 — builds a real strict room at Main Phase.
 *
 * The room comes from @rift/engine's real `createInitialGameState` + the real engine host, so
 * every scenario exercises the same zone/log/scoring primitives the server uses.
 */
import { expect } from "vitest";

import type {
  BattlefieldZone,
  CardInstance,
  CardScript,
  GameEvent,
  ObjectRulesState,
  PromptAnswer,
  Room,
  RulesIntent,
} from "@rift/protocol";
// Relative source import: the engine may not be a workspace dependency of @rift/rules
// (a devDependency would create a pnpm workspace task cycle through the engine hook).
import { createInitialGameState } from "../../../engine/src/index";
import {
  applyRulesIntent,
  initializeStrictRules,
  legalIntents,
  registerCardScript,
  turnState,
  whoMayAct,
  type RulesContext,
  type RulesIntentResult,
} from "../../src";
import { createEngineRulesHost } from "../../../engine/src/strict/host";

import { loadFixtureDecks as loadDecks } from "../fixtures/decks";

let scenarioCounter = 0;

export function deterministicContext(seed = 123456789): RulesContext {
  let state = seed >>> 0;
  return {
    now: 1_760_000_000_000,
    rng: () => {
      state = (1664525 * state + 0x3c6ef35f) >>> 0;
      return state / 0x100000000;
    },
    mode: "multiplayer",
  };
}

export interface PlayerScenarioInput {
  hand?: string[];
  runes?: string[];
  energy?: number;
  power?: Partial<Record<string, number>>;
}

export interface ScenarioInput {
  p1?: PlayerScenarioInput;
  p2?: PlayerScenarioInput;
  firstPlayer?: "p1" | "p2";
  /** Optional battlefield names (defaults to the deck's own battlefields). */
  battlefields?: { p1?: string; p2?: string };
  seed?: number;
  roomCode?: string;
}

export function scenario(input: ScenarioInput = {}): RulesScenario {
  return new RulesScenario(input);
}

/** Register a card script for this suite (thin alias kept next to the scenario helpers). */
export function register(script: CardScript): CardScript {
  return registerCardScript(script);
}

export class RulesScenario {
  room: Room;
  readonly ctx: RulesContext;
  readonly host;
  private actorId = "p1";
  private lastResult: RulesIntentResult | null = null;
  private lastEvents: GameEvent[] = [];

  constructor(input: ScenarioInput) {
    const decks = loadDecks();
    const ctx = deterministicContext(input.seed ?? ++scenarioCounter * 7919);
    this.ctx = ctx;
    const room = createInitialGameState({
      roomCode: input.roomCode ?? `RULES-${++scenarioCounter}`,
      createdAt: ctx.now,
      phase: "in_game",
      gameVariant: "duel",
      roomMode: "multiplayer",
      shuffleDecks: false,
      players: [
        {
          id: "p1",
          name: "Alice",
          submittedDeck: { sections: decks.deckA.sections, raw: decks.deckA.raw },
          decklistRaw: decks.deckA.raw,
        },
        {
          id: "p2",
          name: "Bob",
          submittedDeck: { sections: decks.deckB.sections, raw: decks.deckB.raw },
          decklistRaw: decks.deckB.raw,
        },
      ],
    });
    room.rulesMode = "strict";
    room.firstPlayerId = input.firstPlayer === "p2" ? "p2" : "p1";
    room.turnNumber = 1;
    room.activeTurnPlayerId = room.firstPlayerId;

    const p1 = room.players.find((player) => player.id === "p1");
    const p2 = room.players.find((player) => player.id === "p2");
    if (p1) p1.selectedBattlefield = input.battlefields?.p1 ?? decks.deckA.sections.battlefields[0]?.name;
    if (p2) p2.selectedBattlefield = input.battlefields?.p2 ?? decks.deckB.sections.battlefields[0]?.name;

    this.putInHand(room, "p1", input.p1?.hand ?? []);
    this.putInHand(room, "p2", input.p2?.hand ?? []);
    this.putRunes(room, "p1", input.p1?.runes ?? []);
    this.putRunes(room, "p2", input.p2?.runes ?? []);

    this.host = createEngineRulesHost(ctx);
    this.room = initializeStrictRules(room, ctx, this.host);
    this.setPool("p1", input.p1?.energy ?? 0, input.p1?.power ?? {});
    this.setPool("p2", input.p2?.energy ?? 0, input.p2?.power ?? {});
  }

  private putInHand(room: Room, playerId: string, names: string[]): void {
    const board = room.players.find((player) => player.id === playerId)?.board;
    if (!board) return;
    for (const name of names) {
      const index = board.deck.findIndex((card) => card.name === name);
      if (index < 0) continue;
      const [card] = board.deck.splice(index, 1);
      if (card) board.hand.push(card);
    }
  }

  private putRunes(room: Room, playerId: string, names: string[]): void {
    const board = room.players.find((player) => player.id === playerId)?.board;
    if (!board) return;
    for (const name of names) {
      const index = board.runeDeck.findIndex((card) => card.name === name);
      if (index < 0) continue;
      const [rune] = board.runeDeck.splice(index, 1);
      if (rune) board.runeArea.push({ ...rune, exhausted: false });
    }
  }

  private setPool(playerId: string, energy: number, power: Partial<Record<string, number>>): void {
    if (!this.room.rules) return;
    this.room.rules.pools[playerId] = { energy, power: { ...power } };
  }

  /**
   * Test-fixture helper (additive): move a card from a player's Main Deck to a hand (defaults to
   * the same player). Used to build reaction windows that the opening hand does not cover.
   */
  moveDeckCardToHand(playerId: string, name: string, toPlayerId = playerId): this {
    const board = this.room.players.find((player) => player.id === playerId)?.board;
    if (!board) throw new Error(`moveDeckCardToHand: no board for ${playerId}`);
    const target = this.room.players.find((player) => player.id === toPlayerId)?.board;
    if (!target) throw new Error(`moveDeckCardToHand: no board for ${toPlayerId}`);
    const index = board.deck.findIndex((card) => card.name === name);
    if (index < 0) throw new Error(`moveDeckCardToHand: ${name} is not in ${playerId}'s deck`);
    const [card] = board.deck.splice(index, 1);
    if (card) target.hand.push(card);
    return this;
  }

  /**
   * Test-fixture helper (additive): place a card from a player's Main Deck directly into a board
   * zone (no intent, no cleanup). Used to set up control proxies and combat battlefields.
   */
  placeFromDeck(playerId: string, name: string, zone: string): this {
    const board = this.room.players.find((player) => player.id === playerId)?.board;
    if (!board) throw new Error(`placeFromDeck: no board for ${playerId}`);
    const index = board.deck.findIndex((card) => card.name === name);
    if (index < 0) throw new Error(`placeFromDeck: ${name} is not in ${playerId}'s deck`);
    const list = (board as unknown as Record<string, CardInstance[] | undefined>)[zone];
    if (!list) throw new Error(`placeFromDeck: unknown board zone ${zone}`);
    const [card] = board.deck.splice(index, 1);
    if (card) list.push({ ...card, exhausted: false });
    return this;
  }

  as(playerId: string): this {
    this.actorId = playerId;
    return this;
  }

  apply(intent: RulesIntent): this {
    const result = applyRulesIntent(this.room, this.actorId, intent, this.ctx, this.host);
    this.lastResult = result;
    this.lastEvents = result.ok ? result.events : [];
    if (result.ok) this.room = result.room;
    return this;
  }

  play(name: string, options: { hold?: boolean; choices?: Record<string, unknown>; location?: string } = {}): this {
    const card = this.findHandCard(name);
    if (!card) throw new Error(`play: ${name} is not in ${this.actorId}'s hand`);
    return this.apply({
      type: "rules_play",
      cardId: card.id,
      ...(options.hold !== undefined ? { hold: options.hold } : {}),
      ...(options.choices ? { choices: options.choices as never } : {}),
      ...(options.location ? { location: options.location as never } : {}),
    });
  }

  activate(objectName: string, ability = "activated:0", options: { hold?: boolean } = {}): this {
    const located = this.findBoardCard(objectName);
    if (!located) throw new Error(`activate: ${objectName} is not on the board`);
    return this.apply({
      type: "rules_activate",
      objectId: located.id,
      ability,
      ...(options.hold !== undefined ? { hold: options.hold } : {}),
    });
  }

  move(unitName: string, to: BattlefieldZone | "base"): this {
    const located = this.findBoardCard(unitName);
    if (!located) throw new Error(`move: ${unitName} is not on the board`);
    return this.apply({ type: "rules_move", unitIds: [located.id], to });
  }

  pass(): this {
    return this.apply({ type: "rules_pass" });
  }

  endTurn(): this {
    return this.apply({ type: "rules_end_turn" });
  }

  choose(answer: PromptAnswer): this {
    const prompt = this.room.rules?.prompt;
    if (!prompt) throw new Error("choose: no prompt is pending");
    return this.apply({ type: "rules_choose", promptId: prompt.id, answer });
  }

  manualDone(): this {
    return this.apply({ type: "rules_manual_done" });
  }

  findHandCard(name: string) {
    return this.handCard(this.actorId, name);
  }

  handCard(playerId: string, name: string) {
    const board = this.room.players.find((player) => player.id === playerId)?.board;
    return board?.hand.find((card) => card.name === name);
  }

  findBoardCard(name: string) {
    const board = this.room.players.find((player) => player.id === this.actorId)?.board;
    if (!board) return undefined;
    for (const zone of ["base", "battlefieldA", "battlefieldB", "battlefieldC"] as const) {
      const card = (board[zone] ?? []).find((entry) => entry.name === name);
      if (card) return card;
    }
    return undefined;
  }

  /** Any board object by name, across every player and board zone (R2 helper). */
  findBoardCardAnywhere(name: string): CardInstance | undefined {
    for (const player of this.room.players) {
      const board = player.board;
      if (!board) continue;
      for (const zone of ["base", "battlefieldA", "battlefieldB", "battlefieldC", "legend", "runeArea"] as const) {
        const card = (board[zone] ?? []).find((entry) => entry.name === name);
        if (card) return card;
      }
    }
    return undefined;
  }

  expectPrompt(kind?: string, playerId?: string): this {
    const prompt = this.room.rules?.prompt ?? null;
    expect(prompt, "no prompt is pending").toBeTruthy();
    if (kind) expect(prompt?.kind).toBe(kind);
    if (playerId) expect(prompt?.playerId).toBe(playerId);
    return this;
  }

  expectEvents(type: string): this {
    expect(this.lastEvents.map((event) => event.type)).toContain(type);
    return this;
  }

  expectObject(name: string, partial: Partial<ObjectRulesState>): this {
    const card = this.findBoardCardAnywhere(name);
    expect(card, `object ${name} is not on the board`).toBeTruthy();
    const object = card ? this.room.rules?.objects[card.id] : undefined;
    expect(object, `object ${name} has no rules state`).toBeTruthy();
    expect(object).toMatchObject(partial);
    return this;
  }

  expectScore(playerId: string, score: number): this {
    const board = this.room.players.find((player) => player.id === playerId)?.board;
    expect(board?.score ?? 0).toBe(score);
    return this;
  }

  expectOk(): this {
    if (!this.lastResult) throw new Error("no intent applied");
    expect(this.lastResult.ok, this.lastResult.ok ? "" : `${this.lastResult.code} (${this.lastResult.rule})`).toBe(true);
    return this;
  }

  expectError(code: string): this {
    if (!this.lastResult) throw new Error("no intent applied");
    expect(this.lastResult.ok).toBe(false);
    if (!this.lastResult.ok) expect(this.lastResult.code).toBe(code);
    return this;
  }

  expectState(state: string): this {
    expect(turnState(this.room)).toBe(state);
    return this;
  }

  expectPriority(playerId: string | null): this {
    expect(this.room.rules?.priority ?? null).toBe(playerId);
    return this;
  }

  expectFocus(playerId: string | null): this {
    expect(this.room.rules?.focus ?? null).toBe(playerId);
    return this;
  }

  expectWho(kind: string, playerId?: string): this {
    const who = whoMayAct(this.room);
    expect(who.kind).toBe(kind);
    if (playerId) expect("player" in who ? who.player : null).toBe(playerId);
    return this;
  }

  expectPhase(phase: string, step?: string): this {
    expect(this.room.rules?.turn.phase).toBe(phase);
    if (step) expect(this.room.rules?.turn.step).toBe(step);
    return this;
  }

  expectZone(playerId: string, name: string, zone: string): this {
    const board = this.room.players.find((player) => player.id === playerId)?.board;
    const list = board ? ((board as unknown as Record<string, Array<{ name: string }>>)[zone] ?? []) : [];
    expect(list.some((card) => card.name === name)).toBe(true);
    return this;
  }

  expectLegal(playerId?: string): ReturnType<typeof legalIntents> {
    return legalIntents(this.room, playerId ?? this.actorId, this.host);
  }

  events(): GameEvent[] {
    return this.lastEvents;
  }

  lastError(): { code: string; rule: string } | null {
    return this.lastResult && !this.lastResult.ok
      ? { code: this.lastResult.code, rule: this.lastResult.rule }
      : null;
  }
}


