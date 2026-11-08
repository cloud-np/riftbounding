/**
 * Engine boundary.
 *
 * The authoritative rules engine lives in `@rift/engine` and is written concurrently by another
 * agent against the contract in `docs/ARCHITECTURE.md`. This adapter is the only place the realtime
 * server touches it:
 *
 *  - when the engine exports `createInitialGameState` / `applyGameAction`, those are used
 *    (config mapped to the engine's `GameSetupConfig`);
 *  - otherwise a small development engine keeps rooms playable.
 *
 * TODO(engine): delete `fallback-engine.ts` once @rift/engine is complete and verified.
 */

import type { DeckSections, Room } from "@rift/protocol";
import type { EngineActionContext, EngineActionResult, EngineSetupConfig } from "./engine-types";
import { applyFallbackAction, createFallbackInitialState } from "./fallback-engine";

interface EngineDeckData {
  raw: string;
  sections: DeckSections;
}

interface EngineSetupPlayer {
  id: string;
  seat: number;
  name: string;
  joinedAt: number;
  decklistRaw?: string;
  deck?: EngineDeckData;
  submittedDeck?: EngineDeckData;
  battlefieldOptions?: string[];
  selectedBattlefield?: string;
  selectedBattlefieldCardCode?: string;
}

interface EngineSetupConfigLike {
  roomCode: string;
  createdAt: number;
  updatedAt: number;
  players: EngineSetupPlayer[];
  hostPlayerId?: string;
  gameVariant?: string;
  roomMode?: string;
  playMode?: string;
  deckRulesMode?: string;
  matchFormat?: string;
  gameNumber?: number;
  seriesStartedAt?: number;
  winsByPlayerId?: Record<string, number>;
  teamIdByPlayerId?: Record<string, string>;
  testMode?: boolean;
  setupOrderVersion?: number;
  singlePlayerTurnOrder?: "play_first" | "play_second";
  soloSetupPending?: boolean;
  starterChooserPlayerId?: string;
  usedBattlefieldsByPlayerId?: Record<string, string[]>;
  phase?: string;
  log?: Room["log"];
  bo3CompletedGames?: Room["bo3CompletedGames"];
}

interface EngineModule {
  createInitialGameState?: (config: EngineSetupConfigLike) => Room | Promise<Room>;
  applyGameAction?: (
    state: Room,
    actorPlayerId: string,
    action: Record<string, unknown> & { type: string },
    ctx: EngineActionContext,
  ) => EngineActionResult | Promise<EngineActionResult>;
}

let enginePromise: Promise<EngineModule> | null = null;

async function loadEngineModule(): Promise<EngineModule> {
  if (!enginePromise) {
    enginePromise = import("@rift/engine")
      .then((module) => module as unknown as EngineModule)
      .catch(() => ({}));
  }
  return enginePromise;
}

export type EngineKind = "real" | "fallback";

/** Resolve which engine implementation will be used (used by the health endpoint/smoke script). */
export async function engineKind(): Promise<EngineKind> {
  const module = await loadEngineModule();
  return typeof module.createInitialGameState === "function" &&
    typeof module.applyGameAction === "function"
    ? "real"
    : "fallback";
}

function toEngineConfig(config: EngineSetupConfig): EngineSetupConfigLike {
  const players: EngineSetupPlayer[] = config.players
    .slice()
    .sort((a, b) => a.seat - b.seat)
    .map((player) => {
      const deck = player.deck
        ? { raw: player.deck.raw, sections: player.deck.sections }
        : undefined;
      const battlefieldOptions = deck?.sections.battlefields.flatMap((entry) =>
        Array.from({ length: entry.count }, () => entry.name),
      );
      return {
        id: player.playerId,
        seat: player.seat,
        name: player.name,
        joinedAt: config.createdAt,
        ...(player.decklist ? { decklistRaw: player.decklist } : {}),
        ...(deck ? { deck, submittedDeck: deck } : {}),
        ...(battlefieldOptions && battlefieldOptions.length > 0 ? { battlefieldOptions } : {}),
      };
    });
  return {
    roomCode: config.roomCode,
    createdAt: config.createdAt,
    updatedAt: config.createdAt,
    players,
    hostPlayerId: config.hostPlayerId ?? players[0]?.id,
    gameVariant: config.gameVariant,
    roomMode: config.roomMode,
    playMode: config.playMode,
    deckRulesMode: config.deckRulesMode,
    matchFormat: config.matchFormat,
    gameNumber: config.gameNumber,
    seriesStartedAt: config.seriesStartedAt,
    winsByPlayerId: config.winsByPlayerId,
    teamIdByPlayerId: config.teamIdByPlayerId,
    testMode: config.testMode,
    setupOrderVersion: 2,
    singlePlayerTurnOrder: config.singlePlayerTurnOrder,
    soloSetupPending: config.soloSetupPending,
    starterChooserPlayerId: config.starterChooserPlayerId,
    usedBattlefieldsByPlayerId: config.usedBattlefieldsByPlayerId,
    ...(config.phase ? { phase: config.phase } : {}),
    ...(config.log ? { log: config.log } : {}),
    ...(config.bo3CompletedGames ? { bo3CompletedGames: config.bo3CompletedGames } : {}),
  };
}

export async function createInitialGameState(config: EngineSetupConfig): Promise<Room> {
  const module = await loadEngineModule();
  if (typeof module.createInitialGameState === "function") {
    return await module.createInitialGameState(toEngineConfig(config));
  }
  return createFallbackInitialState(config);
}

export async function applyGameAction(
  state: Room,
  actorPlayerId: string,
  action: unknown,
  ctx: EngineActionContext,
): Promise<EngineActionResult> {
  const module = await loadEngineModule();
  if (typeof module.applyGameAction === "function") {
    const record = action as Record<string, unknown> & { type: string };
    return await module.applyGameAction(state, actorPlayerId, record, {
      now: ctx.now,
      rng: ctx.rng,
      mode: ctx.mode,
      ...(ctx.timeline ? { timeline: ctx.timeline } : {}),
    });
  }
  return applyFallbackAction(state, actorPlayerId, action, ctx);
}
