/**
 * Internal engine types shared by the transition entry and the per-domain handlers.
 * Public contract types live in @rift/protocol; the additions here are engine-only.
 */
import type {
  CardInstance,
  DeckRulesMode,
  DeckSections,
  EngineTimeline,
  GameVariant,
  MatchFormat,
  PlayMode,
  Room,
  RoomMode,
  RoomPhase,
  Zone,
} from "@rift/protocol";

/** ARCHITECTURE.md contract. `idFactory` is an optional deterministic extension. */
export interface ActionContext {
  now: number;
  rng: () => number;
  mode: "multiplayer" | "solo_lab" | "single_player";
  /**
   * Optional deterministic id source. The original client mirror derives ids from the
   * action sequence (`<kind>_q<actionId>_<n>`); the server derives them from its RNG.
   * Callers that need reproducible ids can pass a factory here.
   */
  idFactory?: (kind: string) => string;
  /**
   * Server-owned rewind/forward history (protocol v5). Serializable and never part of `Room`.
   * Pass it on every action to keep rewind enabled; the updated value is returned on success.
   * Callers that do not need rewind (e.g. the browser's optimistic apply) may omit it.
   */
  timeline?: EngineTimeline;
}

/** Parsed deck as stored on a room player. */
export interface DeckData {
  raw: string;
  sections: DeckSections;
  totals?: Record<"legend" | "champion" | "mainDeck" | "battlefields" | "runes" | "sideboard", number>;
  warnings?: string[];
  errors?: string[];
}

export interface GameSetupPlayer {
  id: string;
  seat?: number;
  name: string;
  joinedAt?: number;
  decklistRaw?: string;
  /** Any of these three spellings is accepted for convenience. */
  deck?: DeckData | { sections: DeckSections; raw?: string } | null;
  submittedDeck?: { sections: DeckSections; raw?: string } | null;
  registeredDeck?: unknown;
  sealedFormatId?: string;
  sealedDraftId?: string;
  sealedPoolSections?: DeckSections;
  sealedRegisteredDeckSections?: DeckSections;
  isSealedSeat?: boolean;
  selectedBattlefield?: string;
  selectedBattlefieldCardCode?: string;
  battlefieldOptions?: string[];
  battlefieldOptionCount?: number;
  identity?: Record<string, unknown>;
  leftAt?: number;
  leftReason?: "manual" | "returned_to_lobby";
}

/**
 * Input for `createInitialGameState` — "room → game start".
 *
 * The realtime room owner passes the seated players (with their registered decks) and the
 * lobby's variant/format/mode settings; the engine seeds the setup-phase room exactly like
 * the original server projection (35qz5rkx7yexy.js:26930-27010).
 */
export interface GameSetupConfig {
  roomCode: string;
  createdAt?: number;
  /** Alias for `createdAt` (some callers have a clock value but no room object yet). */
  now?: number;
  updatedAt?: number;
  players: GameSetupPlayer[];
  hostPlayerId?: string;
  gameVariant?: GameVariant;
  roomMode?: RoomMode;
  playMode?: PlayMode;
  deckRulesMode?: DeckRulesMode;
  matchFormat?: MatchFormat;
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
  /** Optional override; defaults to sideboarding (bo3 game 2+/sealed) or battlefield_pick. */
  phase?: RoomPhase;
  /** Initial match log (usually empty). */
  log?: Room["log"];
  bo3CompletedGames?: Room["bo3CompletedGames"];
  /**
   * Shuffle the main/rune decks while seeding the room. Default true. When `rng` is omitted
   * a deterministic seed key derived from the room code + player id is used.
   */
  shuffleDecks?: boolean;
  rng?: () => number;
}

export type ActionKind = NonNullable<Room["log"][number]["actionKind"]>;

/** A structured log entry: canonical English text + machine-readable sentence key/params. */
export interface LogDraft {
  key: string;
  params?: Record<string, string | number | null | undefined>;
  text: string;
  at?: number;
  authorPlayerId?: string;
  turnNumber?: number;
  turnPlayerId?: string;
  actionKind?: ActionKind;
}

export interface HandlerContext {
  now: number;
  rng: () => number;
  mode: ActionContext["mode"];
  idFactory: (kind: string) => string;
  actorId: string;
  actorIndex: number;
  /** Append a log entry to the draft room. */
  log: (draft: LogDraft) => void;
  /** Extra ids the actor is allowed to see (solo_lab / spectator grants). */
  authorizedPlayerIds?: string[];
  /** Recursively apply a gameplay action inside the same draft (auto-resolution). */
  applyDeferred: (room: Room, actorId: string, action: Record<string, unknown> & { type: string }) => Room;
}

export interface HandlerArgs {
  room: Room;
  playerIndex: number;
  player: Room["players"][number];
  board: NonNullable<Room["players"][number]["board"]>;
  action: Record<string, unknown> & { type: string };
  context: HandlerContext;
}

/** Per-action handler. Mutates the draft room in place (the caller owns the clone). */
export type ActionHandler = (args: HandlerArgs) => void;

export interface EngineSuccess {
  ok: true;
  state: Room;
  log: Room["log"];
  sound?: string | null;
  /** Present when the caller passed `ActionContext.timeline`; server-only, never sent. */
  timeline?: EngineTimeline;
}

export interface EngineFailure {
  ok: false;
  error: string;
  errorCode?: string;
}

export type EngineResult = EngineSuccess | EngineFailure;

/** Zones that can hold a card in a board. */
export type CardZone = Exclude<Zone, "deck" | "runeDeck">;

export type { CardInstance };
