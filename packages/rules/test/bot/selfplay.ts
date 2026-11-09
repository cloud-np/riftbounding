/**
 * Headless strict self-play harness.
 *
 * Builds a real strict duel from the committed fixture decks (the same decks the scenario DSL
 * uses), then lets the dumb bot play both seats. Each seat only ever sees its own redacted view
 * (`redactRoomForViewer` from `@rift/sync`), exactly like the wire snapshot a client receives;
 * the chosen intent is applied to the authoritative room.
 *
 * The harness is deterministic for a given `(seed, options)`: one `mulberry32` stream drives the
 * engine's shuffles/ids, a second drives the action picker. It never uses `Date`, timers or I/O.
 *
 * Terminations:
 *   - "win"        — `room.gameOutcome` exists;
 *   - "turn_cap"   — the turn number exceeded `maxTurns`;
 *   - "action_cap" — `maxActions` intents were applied;
 *   - "stuck"      — nobody may act, no legal intent, a repeated prompt, a pass loop or no
 *                    observable progress;
 *   - "crash"      — an engine exception, or an intent the picker believed legal was rejected.
 */
import type { DeckSections, GameEvent, Room, RulesIntent } from "@rift/protocol";
import { bestPrintCards } from "@rift/cards";
import { createInitialGameState } from "../../../engine/src/index";
import { createEngineRulesHost } from "../../../engine/src/strict/host";
import {
  applyRulesIntent,
  initializeStrictRules,
  mulberry32,
  pickRandomAction,
  whoMayAct,
  type RulesContext,
} from "../../src";
import { redactRoomForViewer } from "../../../sync/src/redact";
import { loadFixtureDecks } from "../fixtures/decks";

const BASE_TIME = 1_760_000_000_000;
const MAX_REPORT_EVENTS = 40;

export type SelfplayOutcome = "win" | "turn_cap" | "action_cap" | "stuck" | "crash";

export interface SelfplayOptions {
  /** Stop once `rules.turn.number` exceeds this (default 80). */
  maxTurns?: number;
  /** Stop after this many applied intents (default 4000). */
  maxActions?: number;
  /** Consecutive steps with an unchanged public-progress signature before "stuck" (default 40). */
  noProgressLimit?: number;
  /** Consecutive passes before "stuck" (default 40). */
  passStreakLimit?: number;
  /**
   * `"fixture"` (default) plays the committed scenario decks; `"catalog"` builds a random
   * Calm/Chaos main deck from the real card catalog for each seed, exercising many more cards.
   */
  deckMode?: "fixture" | "catalog";
}

export interface SelfplayReport {
  seed: number;
  outcome: SelfplayOutcome;
  /** Number of applied intents. */
  step: number;
  /** `rules.turn.number` at the terminal state. */
  turn: number;
  actor: string | null;
  intent: RulesIntent | null;
  /** Why the game stopped (stuck reason / crash message / cap). */
  reason?: string;
  /** Rejection returned by `applyRulesIntent` for an intent the picker believed legal. */
  reject?: { code: string; rule: string; detail?: string };
  winnerPlayerIds?: string[];
  scores?: Record<string, number>;
  lastEvents: GameEvent[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A deterministic 39-card Calm/Chaos main deck sampled from the real card catalog. */
function catalogMainDeck(seed: number, random: () => number): DeckSections["mainDeck"] {
  const pool = bestPrintCards().filter(
    (card) =>
      !card._isToken &&
      !card.isAltArt &&
      card.type !== "Rune" &&
      card.type !== "Legend" &&
      card.type !== "Battlefield" &&
      card.domains.length > 0 &&
      card.domains.every((domain) => domain === "Calm" || domain === "Chaos"),
  );
  if (pool.length < 13) throw new Error(`catalog deck: only ${pool.length} Calm/Chaos cards`);
  // Fisher-Yates with the game's own deterministic stream, then one entry per unique name.
  const shuffled = [...pool];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const tmp = shuffled[index]!;
    shuffled[index] = shuffled[other]!;
    shuffled[other] = tmp;
  }
  const seen = new Set<string>();
  const chosen: typeof pool = [];
  for (const card of shuffled) {
    if (seen.has(card.name)) continue;
    seen.add(card.name);
    chosen.push(card);
    if (chosen.length === 13) break;
  }
  if (chosen.length < 13) throw new Error(`catalog deck: seed ${seed} found ${chosen.length} names`);
  return chosen.map((card) => ({ name: card.name, count: 3, cardCode: card.id }));
}

function buildRoom(seed: number, ctx: RulesContext, deckMode: "fixture" | "catalog"): Room {
  const decks = loadFixtureDecks();
  // Alternate which fixture deck sits in seat 1 so both decks play both sides.
  const swap = seed % 2 !== 0;
  const deckA = swap ? decks.deckB : decks.deckA;
  const deckB = swap ? decks.deckA : decks.deckB;
  const alternate = deckMode === "catalog";
  const sectionsA: DeckSections = alternate
    ? { ...deckA.sections, mainDeck: catalogMainDeck(seed, mulberry32((seed ^ 0x2545f491) >>> 0)) }
    : deckA.sections;
  const sectionsB: DeckSections = alternate
    ? { ...deckB.sections, mainDeck: catalogMainDeck(seed + 100_000, mulberry32((seed ^ 0x6c8e9cf5) >>> 0)) }
    : deckB.sections;
  const room = createInitialGameState({
    roomCode: `SELFPLAY-${seed}`,
    createdAt: BASE_TIME,
    phase: "in_game",
    gameVariant: "duel",
    roomMode: "multiplayer",
    shuffleDecks: true,
    rng: ctx.rng,
    players: [
      {
        id: "p1",
        name: "Selfplay One",
        submittedDeck: { sections: sectionsA, raw: deckA.raw },
        decklistRaw: deckA.raw,
      },
      {
        id: "p2",
        name: "Selfplay Two",
        submittedDeck: { sections: sectionsB, raw: deckB.raw },
        decklistRaw: deckB.raw,
      },
    ],
  });
  room.rulesMode = "strict";
  const firstPlayer = seed % 3 === 0 ? "p2" : "p1";
  room.firstPlayerId = firstPlayer;
  room.turnNumber = 1;
  room.activeTurnPlayerId = firstPlayer;
  const p1 = room.players.find((player) => player.id === "p1");
  const p2 = room.players.find((player) => player.id === "p2");
  if (p1) p1.selectedBattlefield = deckA.sections.battlefields[0]?.name;
  if (p2) p2.selectedBattlefield = deckB.sections.battlefields[0]?.name;
  return room;
}

function cardKeys(cards: Array<{ id: string; exhausted?: boolean }> | undefined): string[] {
  return (cards ?? []).map((card) => (card.exhausted ? `${card.id}!` : card.id));
}

function scores(room: Room): Record<string, number> {
  const out: Record<string, number> = {};
  for (const player of room.players) out[player.id] = player.board?.score ?? 0;
  return out;
}

/**
 * Lasting-progress signature: only facts that represent real advancement (turn, score, card
 * movement, pools, control/showdown state). Transient windows and pending objects (priority,
 * passes, prompt/manual ids, chain items, tasks) are excluded, so a cycle that re-opens and
 * resolves a no-op chain item or manual window is detected as stuck.
 */
function progressSignature(room: Room): string {
  const rules = room.rules;
  const players = room.players.map((player) => {
    const board = player.board;
    return {
      score: board?.score ?? 0,
      hand: cardKeys(board?.hand),
      base: cardKeys(board?.base),
      a: cardKeys(board?.battlefieldA),
      b: cardKeys(board?.battlefieldB),
      c: cardKeys(board?.battlefieldC),
      runeArea: cardKeys(board?.runeArea),
      trash: cardKeys(board?.trash),
      banished: cardKeys(board?.banished),
      deck: board?.deck.length ?? 0,
      runeDeck: board?.runeDeck.length ?? 0,
    };
  });
  return JSON.stringify({
    players,
    turn: rules?.turn,
    pools: rules?.pools,
    showdown: rules?.showdown ?? null,
    contested: rules?.contested,
    staged: rules?.staged,
  });
}

/** Run one seeded strict game to a terminal state. */
export function selfplay(seed: number, options: SelfplayOptions = {}): SelfplayReport {
  const maxTurns = options.maxTurns ?? 80;
  const maxActions = options.maxActions ?? 4000;
  const noProgressLimit = options.noProgressLimit ?? 40;
  const passStreakLimit = options.passStreakLimit ?? 40;
  const deckMode = options.deckMode ?? "fixture";

  const ctx: RulesContext = {
    now: BASE_TIME,
    // Engine ids/shuffles: deterministic and independent of the action-choice stream.
    rng: mulberry32((seed ^ 0x9e3779b9) >>> 0),
    mode: "multiplayer",
  };
  const host = createEngineRulesHost(ctx);
  let room: Room;
  try {
    room = initializeStrictRules(buildRoom(seed, ctx, deckMode), ctx, host);
  } catch (error) {
    return {
      seed,
      outcome: "crash",
      step: 0,
      turn: 0,
      actor: null,
      intent: null,
      reason: `setup: ${errorMessage(error)}`,
      lastEvents: [],
    };
  }

  const actionRandom = mulberry32((seed ^ 0x51ed270b) >>> 0);
  const lastEvents: GameEvent[] = [];
  let lastProgress = progressSignature(room);
  let lastProgressStep = 0;
  const recentSignatures = new Map<string, number>();
  let cycleRepeats = 0;
  let cycleGap = 0;
  let passStreak = 0;
  let repeatedPrompts = 0;
  let step = 0;

  for (;;) {
    if (room.gameOutcome) {
      return {
        seed,
        outcome: "win",
        step,
        turn: room.rules?.turn.number ?? 0,
        actor: null,
        intent: null,
        winnerPlayerIds: [...room.gameOutcome.winnerPlayerIds],
        scores: scores(room),
        lastEvents: lastEvents.slice(-MAX_REPORT_EVENTS),
      };
    }
    const rules = room.rules;
    if (!rules) {
      return {
        seed,
        outcome: "stuck",
        step,
        turn: 0,
        actor: null,
        intent: null,
        reason: "missing RulesState",
        lastEvents: lastEvents.slice(-MAX_REPORT_EVENTS),
      };
    }
    if (rules.turn.number > maxTurns) {
      return {
        seed,
        outcome: "turn_cap",
        step,
        turn: rules.turn.number,
        actor: null,
        intent: null,
        reason: `turn ${rules.turn.number} > ${maxTurns}`,
        scores: scores(room),
        lastEvents: lastEvents.slice(-MAX_REPORT_EVENTS),
      };
    }
    if (step >= maxActions) {
      return {
        seed,
        outcome: "action_cap",
        step,
        turn: rules.turn.number,
        actor: null,
        intent: null,
        reason: `${step} actions >= ${maxActions}`,
        scores: scores(room),
        lastEvents: lastEvents.slice(-MAX_REPORT_EVENTS),
      };
    }

    const who = whoMayAct(room);
    if (who.kind === "none") {
      return {
        seed,
        outcome: "stuck",
        step,
        turn: rules.turn.number,
        actor: null,
        intent: null,
        reason: `nobody may act (phase ${rules.turn.phase})`,
        scores: scores(room),
        lastEvents: lastEvents.slice(-MAX_REPORT_EVENTS),
      };
    }
    const actor = who.player;
    const view = redactRoomForViewer(room, { playerId: actor, viewerRole: "player" });
    let intent: RulesIntent | null;
    try {
      intent = pickRandomAction(view, actor, host, actionRandom);
    } catch (error) {
      return {
        seed,
        outcome: "crash",
        step,
        turn: rules.turn.number,
        actor,
        intent: null,
        reason: `pick: ${errorMessage(error)}`,
        scores: scores(room),
        lastEvents: lastEvents.slice(-MAX_REPORT_EVENTS),
      };
    }
    if (!intent) {
      return {
        seed,
        outcome: "stuck",
        step,
        turn: rules.turn.number,
        actor,
        intent: null,
        reason: `no legal intent (window ${who.window})`,
        scores: scores(room),
        lastEvents: lastEvents.slice(-MAX_REPORT_EVENTS),
      };
    }

    let result: ReturnType<typeof applyRulesIntent>;
    try {
      result = applyRulesIntent(room, actor, intent, ctx, host);
    } catch (error) {
      return {
        seed,
        outcome: "crash",
        step,
        turn: rules.turn.number,
        actor,
        intent,
        reason: `apply: ${errorMessage(error)}`,
        scores: scores(room),
        lastEvents: lastEvents.slice(-MAX_REPORT_EVENTS),
      };
    }
    if (!result.ok) {
      return {
        seed,
        outcome: "crash",
        step,
        turn: rules.turn.number,
        actor,
        intent,
        reject: {
          code: result.code,
          rule: result.rule,
          ...(result.detail !== undefined ? { detail: result.detail } : {}),
        },
        reason: `rejected ${intent.type}: ${result.code} (${result.rule})`,
        scores: scores(room),
        lastEvents: lastEvents.slice(-MAX_REPORT_EVENTS),
      };
    }

    room = result.room;
    ctx.now += 1;
    step += 1;
    lastEvents.push(...result.events);
    if (lastEvents.length > MAX_REPORT_EVENTS * 4) lastEvents.splice(0, lastEvents.length - MAX_REPORT_EVENTS * 4);

    if (intent.type === "rules_choose" && room.rules?.prompt?.id === intent.promptId) {
      repeatedPrompts += 1;
      if (repeatedPrompts >= 3) {
        return {
          seed,
          outcome: "stuck",
          step,
          turn: room.rules?.turn.number ?? rules.turn.number,
          actor,
          intent,
          reason: `prompt ${intent.promptId} stayed open after 3 answers`,
          scores: scores(room),
          lastEvents: lastEvents.slice(-MAX_REPORT_EVENTS),
        };
      }
    } else {
      repeatedPrompts = 0;
    }

    passStreak = intent.type === "rules_pass" ? passStreak + 1 : 0;
    if (passStreak >= passStreakLimit) {
      return {
        seed,
        outcome: "stuck",
        step,
        turn: room.rules?.turn.number ?? rules.turn.number,
        actor,
        intent,
        reason: `${passStreak} consecutive passes`,
        scores: scores(room),
        lastEvents: lastEvents.slice(-MAX_REPORT_EVENTS),
      };
    }

    const signature = progressSignature(room);
    const previous = recentSignatures.get(signature);
    if (previous !== undefined && step - previous <= 16) {
      cycleRepeats += 1;
      cycleGap = step - previous;
      if (cycleRepeats >= 20) {
        return {
          seed,
          outcome: "stuck",
          step,
          turn: room.rules?.turn.number ?? rules.turn.number,
          actor,
          intent,
          reason: `state cycle of ${cycleGap} step(s) repeated ${cycleRepeats} times`,
          scores: scores(room),
          lastEvents: lastEvents.slice(-MAX_REPORT_EVENTS),
        };
      }
    } else {
      cycleRepeats = 0;
    }
    recentSignatures.set(signature, step);
    if (signature !== lastProgress) {
      lastProgress = signature;
      lastProgressStep = step;
    } else if (step - lastProgressStep >= noProgressLimit) {
      return {
        seed,
        outcome: "stuck",
        step,
        turn: room.rules?.turn.number ?? rules.turn.number,
        actor,
        intent,
        reason: `no persistent progress for ${step - lastProgressStep} steps`,
        scores: scores(room),
        lastEvents: lastEvents.slice(-MAX_REPORT_EVENTS),
      };
    }
  }
}
