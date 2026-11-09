/** Shared engine adapter types (kept independent of the @rift/engine implementation). */

import type {
  EngineTimeline,
  GameplayLogEntry,
  GameVariant,
  MatchFormat,
  ParsedDeck,
  PlayMode,
  Room,
  RoomMode,
  RoomPhase,
} from "@rift/protocol";

export interface EngineSeatConfig {
  playerId: string;
  name: string;
  seat: number;
  decklist?: string | null;
  deck?: ParsedDeck | null;
  sealedRegistration?: unknown;
  /** Present for a solo/bot seat controlled by the host. */
  isSoloOpponent?: boolean;
}

export interface EngineSetupConfig {
  roomCode: string;
  createdAt: number;
  now: number;
  roomMode: RoomMode;
  gameVariant: GameVariant;
  playMode: PlayMode;
  deckRulesMode?: "standard" | "unrestricted";
  matchFormat: MatchFormat;
  players: EngineSeatConfig[];
  /** Alias kept for engines that prefer `seats`. */
  seats?: EngineSeatConfig[];
  rng?: () => number;
  /** Strict bot/solo determinism: stored game seed for shuffles and action RNG. */
  rngSeed?: number;
  hostPlayerId?: string;
  teamIdByPlayerId?: Record<string, string>;
  seriesStartedAt?: number;
  gameNumber?: number;
  winsByPlayerId?: Record<string, number>;
  bo3CompletedGames?: Room["bo3CompletedGames"];
  testMode?: boolean;
  singlePlayerTurnOrder?: "play_first" | "play_second";
  soloSetupPending?: boolean;
  starterChooserPlayerId?: string;
  usedBattlefieldsByPlayerId?: Record<string, string[]>;
  phase?: RoomPhase;
  log?: GameplayLogEntry[];
}

export interface EngineActionContext {
  now: number;
  rng: () => number;
  mode: RoomMode;
  /** Serializable rewind v5 history owned by the server; never sent to clients. */
  timeline?: EngineTimeline;
}

export type EngineActionResult =
  | {
      ok: true;
      state: Room;
      log: GameplayLogEntry[];
      sound?: string | null;
      timeline?: EngineTimeline;
    }
  | {
      ok: false;
      error: string;
      errorCode?: string;
      /** Strict rooms (§5): the rule a rejected `rules_*` intent violated. */
      rule?: string;
      /** Strict rooms (§5): the Verdict's optional detail. */
      detail?: string;
    };

export interface EngineAdapter {
  kind: "real" | "fallback";
  createInitialGameState(config: EngineSetupConfig): Promise<Room>;
  applyGameAction(
    state: Room,
    actorPlayerId: string,
    action: unknown,
    ctx: EngineActionContext,
  ): Promise<EngineActionResult>;
}
