/**
 * Local STRICT-rules duel (human seat 0 vs. bot seat 1) for the dev harness.
 *
 * Mirrors what the realtime worker does for a practice-vs-bot room (`MatchRoomCore`):
 *  - `createInitialGameState` with a state-derived `rngSeed`, `rulesMode: "strict"`,
 *    `roomMode: "single_player"` and `isBot` on the second seat;
 *  - `auto_start_test_setup` as the host (battlefields, first player, mulligans, strict init);
 *  - after setup the live room's `roomMode` becomes "multiplayer" (the board must not give the
 *    human control of the bot), while `ActionContext.mode` stays "single_player";
 *  - the bot only sees its own redacted view and acts via `pickStrictBotAction`.
 * Everything is pure and synchronous, so it can be unit tested without React.
 */
import {
  applyGameAction,
  createBotPickerRandom,
  createInitialGameState,
  createInitialTimeline,
  deriveStrictSeed,
  strictWhoMayAct,
  type EngineTimeline,
} from "@rift/engine";
import type { GameplayAction, Room, RulesIntent, WhoMayAct } from "@rift/protocol";
import { pickStrictBotAction } from "@rift/engine";
import { redactRoomForViewer } from "@rift/sync";

import { DEV_CREATED_AT, createSeededRng, parseSeed } from "./localGame";
import {
  applyShowdownScenario,
  buildStrictDecks,
  type ShowdownScenarioInfo,
  type StrictScenarioId,
} from "./strictScenario";

export const STRICT_HUMAN_ID = "dev-human";
export const STRICT_BOT_ID = "dev-bot";
/** Hard bound on consecutive bot actions per burst (same idea as the worker's BOT_ACTION_CAP). */
export const STRICT_BOT_ACTION_CAP = 64;
const CONTEXT_MODE = "single_player" as const;

export interface StrictHarnessState {
  room: Room;
  timeline: EngineTimeline;
  seed: number;
  scenario: StrictScenarioId | null;
  scenarioInfo: ShowdownScenarioInfo | null;
}

export interface StrictIntentRecord {
  id: number;
  actorId: string;
  type: string;
  ok: boolean;
  changed: boolean;
  error?: string;
  errorCode?: string;
  /** "human" | "bot" | "setup" */
  source: "human" | "bot" | "setup";
}

export function strictViewFor(room: Room, playerId: string): Room {
  return redactRoomForViewer(room, { playerId, viewerRole: "player" });
}

/** Deterministic clock so server-side rendering and the browser build the same room. */
function setupClock(): () => number {
  let now = DEV_CREATED_AT + 10_000;
  return () => (now += 1);
}

export function createStrictHarness(
  options: { seed?: string | number | null; scenario?: StrictScenarioId | null } = {},
): StrictHarnessState {
  const seed = parseSeed(options.seed);
  const scenario = options.scenario ?? null;
  const decks = buildStrictDecks();
  const roomCode = "DEVSTRICT";
  const created = createInitialGameState({
    roomCode,
    createdAt: DEV_CREATED_AT,
    players: [
      {
        id: STRICT_HUMAN_ID,
        seat: 0,
        name: "You",
        joinedAt: DEV_CREATED_AT,
        deck: { raw: "", sections: decks[0] },
      },
      {
        id: STRICT_BOT_ID,
        seat: 1,
        name: "Practice Bot",
        joinedAt: DEV_CREATED_AT + 1000,
        deck: { raw: "", sections: decks[1] },
        isBot: true,
      },
    ],
    hostPlayerId: STRICT_HUMAN_ID,
    gameVariant: "duel",
    roomMode: "single_player",
    playMode: "constructed",
    deckRulesMode: "unrestricted",
    matchFormat: "bo1",
    gameNumber: 1,
    shuffleDecks: true,
    rng: createSeededRng(seed ^ 0xa5a5a5a5),
    rngSeed: deriveStrictSeed(`${roomCode}-${seed}`, DEV_CREATED_AT),
  } as Parameters<typeof createInitialGameState>[0]) as Room;
  const withBot: Room = {
    ...created,
    rulesMode: "strict",
    players: created.players.map((player) =>
      player.id === STRICT_BOT_ID ? { ...player, isBot: true } : player,
    ),
  };

  const clock = setupClock();
  const setup = applyGameAction(
    withBot,
    STRICT_HUMAN_ID,
    { type: "auto_start_test_setup" },
    { now: clock(), rng: createSeededRng(seed ^ 0x9e3779b9), mode: CONTEXT_MODE, timeline: createInitialTimeline() },
  ) as ReturnType<typeof applyGameAction> & { ok: boolean };
  if (!setup.ok) {
    throw new Error(`strict dev room: auto setup failed: ${(setup as { error?: string }).error}`);
  }
  // Same hand-over as the worker: after setup the room is a two-seat "multiplayer" table.
  let room: Room = { ...(setup.state as Room), roomMode: "multiplayer" };
  let scenarioInfo: ShowdownScenarioInfo | null = null;
  if (scenario === "showdown") {
    room = structuredClone(room);
    scenarioInfo = applyShowdownScenario(room, STRICT_HUMAN_ID, STRICT_BOT_ID);
  }
  return {
    room,
    timeline: (setup as { timeline?: EngineTimeline }).timeline ?? createInitialTimeline(),
    seed,
    scenario,
    scenarioInfo,
  };
}

export interface StrictStepResult {
  room: Room;
  timeline: EngineTimeline;
  record: Omit<StrictIntentRecord, "id">;
}

function progressKey(room: Room): string {
  return JSON.stringify([room.rules, room.players, room.phase, room.gameOutcome ?? null]);
}

/** Apply one intent as `actorId`; on failure the room is returned unchanged. */
export function applyStrictIntent(
  room: Room,
  timeline: EngineTimeline,
  actorId: string,
  intent: GameplayAction | RulesIntent,
  rng: () => number,
  source: StrictIntentRecord["source"],
  now: number = Date.now(),
): StrictStepResult {
  let result: ReturnType<typeof applyGameAction>;
  try {
    result = applyGameAction(room, actorId, intent as GameplayAction, {
      now,
      rng,
      mode: CONTEXT_MODE,
      timeline,
    });
  } catch (error) {
    return {
      room,
      timeline,
      record: {
        actorId,
        type: intent.type,
        ok: false,
        changed: false,
        error: error instanceof Error ? error.message : String(error),
        errorCode: "engine_threw",
        source,
      },
    };
  }
  if (!result.ok) {
    return {
      room,
      timeline,
      record: {
        actorId,
        type: intent.type,
        ok: false,
        changed: false,
        error: result.error,
        ...(result.errorCode ? { errorCode: result.errorCode } : {}),
        source,
      },
    };
  }
  const next = { ...result.state, roomCode: room.roomCode, updatedAt: now } as Room;
  const changed = progressKey(next) !== progressKey(room);
  return {
    room: changed ? next : room,
    timeline: result.timeline ?? timeline,
    record: { actorId, type: intent.type, ok: true, changed, source },
  };
}

/** The bot's next intent from its own redacted view (null = not the bot's move). */
export function nextBotIntent(room: Room, botId: string = STRICT_BOT_ID): RulesIntent | null {
  if (room.phase !== "in_game" || room.gameOutcome) return null;
  const view = strictViewFor(room, botId);
  return pickStrictBotAction(view, botId, createBotPickerRandom(room, createSeededRng(1)));
}

export function whoMayAct(room: Room): WhoMayAct | null {
  return strictWhoMayAct(room);
}

export function botMayAct(room: Room, botId: string = STRICT_BOT_ID): boolean {
  const who = strictWhoMayAct(strictViewFor(room, botId));
  return !!who && who.kind !== "none" && who.player === botId;
}

/** One bot action (or `null` when the bot has nothing to do). */
export function runBotStep(
  room: Room,
  timeline: EngineTimeline,
  rng: () => number,
  now?: number,
  botId: string = STRICT_BOT_ID,
): StrictStepResult | null {
  const intent = nextBotIntent(room, botId);
  if (!intent) return null;
  return applyStrictIntent(room, timeline, botId, intent, rng, "bot", now);
}

/**
 * Drive the bot until it has nothing to do, an action fails / makes no progress, or `cap`
 * actions ran. Returns every record; used by tests (the UI paces `runBotStep` with a timer).
 */
export function runBotUntilIdle(
  room: Room,
  timeline: EngineTimeline,
  rng: () => number,
  cap: number = STRICT_BOT_ACTION_CAP,
): { room: Room; timeline: EngineTimeline; records: StrictStepResult["record"][]; capped: boolean } {
  const records: StrictStepResult["record"][] = [];
  let state = room;
  let tl = timeline;
  for (let i = 0; i < cap; i += 1) {
    const step = runBotStep(state, tl, rng);
    if (!step) return { room: state, timeline: tl, records, capped: false };
    records.push(step.record);
    if (!step.record.ok || !step.record.changed) {
      return { room: state, timeline: tl, records, capped: false };
    }
    state = step.room;
    tl = step.timeline;
  }
  return { room: state, timeline: tl, records, capped: true };
}
