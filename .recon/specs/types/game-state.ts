/**
 * RiftAtlas / Riftbound simulator — GameState type definitions (best-effort mirror).
 *
 * Derived from client bundles (no server source available):
 *  - .recon/pretty/playapp/03azfb7rltdws.js:1820-2010  (replay-file strict validator: canonical CARD / BOARD / ROOM schema)
 *  - .recon/pretty/playapp/14u_g6w741h2k.js            (zones 78176, helpers 357603, mutators 437381, token 514890/524640)
 *  - .recon/pretty/playapp/25vik2nxxo51i.js            (history/turn engine 487939/408727/70094, conquer 320083)
 *  - .recon/pretty/playapp/35_5a-hj_uv52.js            (phases 51407, auto-pay 888811, normalize 107126, dice 748036)
 *  - .recon/pretty/playapp/35qz5rkx7yexy.js:20777-22720, 26880-27230 (sessionDoc -> room projection, state keys)
 *  - .recon/pretty/playapp/2i0ajg8a836h8.js            (wire message validators)
 *  - .recon/pretty/playapp/1kx2ucot0m321.js:2428+      (variant table 509396, movement legality 375934)
 *  - .recon/pretty/playapp/0xawjzm3yjpr1.js:48020-48080, 47580-47700 (rewind gating, local UI store)
 *
 * Names (fields, literals) are kept verbatim from the bundles. Optionality is as observed:
 * `b(x)` in the replay validator = optional, non-optional there = always present server-side.
 */

/* ------------------------------------------------------------------ zones */

/** All card-holding zones. 965166.g (also 437381.B for the mutable subset). */
export type Zone =
  | "deck"
  | "hand"
  | "base"
  | "trash"
  | "banished"
  | "battlefieldA"
  | "battlefieldB"
  | "battlefieldC"
  | "battlefieldToken"
  | "champion"
  | "legend"
  | "runeDeck"
  | "runeArea";

/** 780855.B — zones that are "on board" (valid `draw_cards.to`, `take_*_from_deck.to`). */
export type BoardZone =
  | "hand"
  | "base"
  | "trash"
  | "battlefieldA"
  | "battlefieldB"
  | "battlefieldC"
  | "battlefieldToken";

/** 780855.S — every zone except deck/runeDeck (used by set_card_hidden etc.). */
export type RevealableZone =
  | BoardZone
  | "banished"
  | "champion"
  | "legend"
  | "runeArea";

/** 780855.O — base + battlefields ("the field"). */
export type FieldZone = "base" | BattlefieldZone;

export type BattlefieldZone =
  | "battlefieldA"
  | "battlefieldB"
  | "battlefieldC"
  | "battlefieldToken";

/** Room phase — replay validator 03azfb7rltdws.js:1857; "lobby" is the pre-game room phase. */
export type RoomPhase =
  | "lobby"
  | "sideboarding"
  | "battlefield_pick"
  | "initiative_roll"
  | "first_player_choice"
  | "mulligan"
  | "in_game";

/** 803127.e — phases in which gameplay realtime runtime is active. */
export type ActiveGameplayPhase =
  | "sideboarding"
  | "battlefield_pick"
  | "initiative_roll"
  | "first_player_choice"
  | "mulligan"
  | "in_game";

/** 509396.B — game variants; label/shortLabel data-driven. */
export type GameVariant = "duel" | "free_for_all_3" | "free_for_all_4" | "teams_2v2";

export type RoomMode = "multiplayer" | "single_player" | "solo_lab";
export type PlayMode = "constructed" | "sealed";
export type DeckRulesMode = "standard" | "unrestricted";
export type MatchFormat = "bo1" | "bo3";
export type ViewerRole = "player" | "spectator";

/** activeTurnStep — only two steps exist (487939.k → 51407.x). */
export type ActiveTurnStep = "beginning" | "main";

/* ------------------------------------------------------------------ cards */

/** Deck-list entry as exchanged inside decklists/registrations (924892, 957839). */
export interface DecklistEntry {
  name: string;
  count: number;
  cardCode?: string;
}

/** Parsed deck (client deck parser 957839.v / deck sections). */
export interface DeckSections {
  legend: DecklistEntry[];
  champion: DecklistEntry[];
  mainDeck: DecklistEntry[];
  battlefields: DecklistEntry[];
  runes: DecklistEntry[];
  sideboard: DecklistEntry[];
}

export interface ParsedDeck {
  raw: string;
  sections: DeckSections;
  totals: {
    legend: number;
    champion: number;
    mainDeck: number;
    battlefields: number;
    runes: number;
    sideboard: number;
  };
  warnings: string[];
  errors: string[];
}

/**
 * Card instance on a board. Canonical strict schema: replay validator 03azfb7rltdws.js:1745-1800
 * (C = v({...})); runtime fields added by the live engine are marked.
 */
export interface CardInstance {
  id: string;                 // "card_<random>" in play, "setup-<owner>-<source>-<i>-<slug>" during setup
  name: string;
  source: "mainDeck" | "champion" | "legend" | "token" | "rune" | "battlefield" | "sideboard" | "duplicate";
  exhausted: boolean;
  createdAt: number;
  ownerPlayerId?: string;
  isDuplicate?: boolean;                 // copy (duplicate_card); tokens also excluded from decks
  hidden?: boolean;                      // face-down (Hidden keyword or manual)
  revealedToPlayerIds?: string[];        // per-recipient reveal (≤4)
  revealedToOpponent?: boolean;
  oriannaAnimation?: { legendId: string; type?: string; might?: number; whiteCounter?: number };
  neekoSourceCardId?: string;            // legend zone only: Neeko copied legend
  attachedToCardId?: string;             // unit gear attached to a unit
  banishedByCardId?: string;             // Dockside Lock-Up banish link
  banishedByHiddenSourcePlayerId?: string;
  banishedUntilEndingPlayerId?: string;
  empowerTriggerUsed?: boolean;
  cardCode?: string;
  hasWhenYouPlayMe?: boolean;
  type?: string;                         // "Unit" | "Spell" | "Gear" | "Legend" | "Rune" | "Battlefield" | "Unit Gear" | "Card"
  domains?: string[];                    // "Body" | "Calm" | "Chaos" | "Fury" | "Mind" | "Order"
  text?: string;
  energyCost?: number;
  powerCost?: number;
  might?: number;
  temporaryMightBuff?: number;           // [Buff] helper: +1 might each, decremented by player
  whiteCounter?: number;                 // generic counter (may initialize at unit might)
  redCounter?: number;                   // "red" counter option
  customLabels?: string[];               // storage ≤16 strings (03az…:1770); UI manages 3 slots, labels trimmed to 24 chars
  rarity?: string;
  set?: string;
  keywords?: string[];
  subtypes?: string[];
  isPlaceholder?: boolean;               // unknown card name
  imageUrl?: string | null;              // resolved client-side
}

/** board.deckPeek (78176): deck/runeDeck top/bottom inspection session. */
export interface DeckPeek {
  cardIds: string[];
  revealedCardIds: string[];
  autoRevealNewCards?: boolean;
  revision?: number;                     // bump when a new peek session opens
  zone?: "deck" | "runeDeck";            // present only for runeDeck peeks
}

/** board — replay validator 03azfb7rltdws.js:1800-1846 + live additions. */
export interface PlayerBoard {
  score: number;
  floatingEnergy: number;
  floatingPower: number;
  legendXp?: number;
  deck: CardInstance[];
  recycledDeckBottomCount?: number;      // bottom cards preserved by shuffle_deck{preserveRecycledBottom}
  hand: CardInstance[];
  handRevealToOpponent: boolean;
  handRevealedToPlayerIds?: string[];
  base: CardInstance[];
  trash: CardInstance[];
  banished: CardInstance[];
  battlefieldA: CardInstance[];
  battlefieldB: CardInstance[];
  battlefieldC?: CardInstance[];
  battlefieldToken: CardInstance[];
  champion: CardInstance[];
  legend: CardInstance[];
  additionalLegends?: CardInstance[];    // Neeko: extra legends moved aside
  runeDeck: CardInstance[];
  runeArea: CardInstance[];
  deckPeek: DeckPeek;
}

/** Per-player toggles (650417 R + set_* actions). */
export interface BoardSettings {
  showLegendXpCounter: boolean;          // default false
  stopAtBeginningPhase: boolean;         // default false (else beginning phase auto-completes)
  skipDrawPhase: boolean;                // default false
  autoScoreFromHold: boolean;            // default true
}

/** Chain (the stack). 78176.w (normalize) + 487939.y (add). */
export interface ChainEntry {
  id: string;                            // "chain_<n>_<n>" or client-provided
  card: CardInstance;
  addedAt: number;
  fromZone: Zone | "battlefieldMarker" | "deck" | "hand" | "base" | "trash" | "champion" | "legend" | "runeArea" | "banished";
  sourceCardId?: string;
  byPlayerId: string;
  byPlayerName: string;
  repeatEnabled?: boolean;               // [Repeat] toggle
  flowEnabled?: boolean;                 // [Flow] toggle → resolves to banished instead of trash
  passesShowdownFocusOnResolution?: boolean;
}

/** Conquer/showdown assist state machine (320083? no: 487939 + 14u d5). */
export interface PendingBattlefieldConquerAssist {
  zone: BattlefieldZone;
  attackerPlayerId: string;
  defenderPlayerId: string;
  actualDefenderPlayerId?: string;       // multiplayer: actual unit-holder defender
  stage: "attacker_focus" | "defender_response" | "attacker_confirm_conquer";
  optionalPassedPlayerIds?: string[];
  attackerCanPassFocus?: boolean;
  defenderSideWasEmptyAtStart?: boolean;
  turnNumber?: number;
}

/** Per-turn hold bookkeeping (822434.L/b + 856018.M). */
export interface BattlefieldPresenceMap {
  battlefieldA: boolean;
  battlefieldB: boolean;
  battlefieldC: boolean;
  battlefieldToken: boolean;
  turnNumber?: number;
}

export interface SharedBattlefieldToken {
  kind: "baron_pit";
  zone: "battlefieldToken";
  title: string;                         // "Baron Pit"
  active: boolean;
}

export interface TargetArrow {
  sourceCardId: string;
  targetCardId: string;
  sourceAnchor: "board" | "chain";
  targetAnchor: "board" | "chain";
}

/* ------------------------------------------------------------------ turn / game outcome */

export interface GameOutcome {
  winnerPlayerIds: string[];
  reason: "score" | "concession";
  decidedAtTurnNumber: number;
}

export interface Bo3CompletedGame {
  gameNumber: number;
  scoresByPlayerId: Record<string, number>;
  actionClockMsByPlayerId?: Record<string, number>;
  durationMs: number;
}

export interface DieRoll {
  id: string;
  playerId: string;
  sides: 4 | 6 | 8 | 10 | 12 | 20;
  result: number;
  rolledAt: number;
}

/** Action clock (229172.S) — chess-clock style per-player accumulation. */
export interface ActionClock {
  scopeKey: string;
  totals: Record<string, number>;        // ms per playerId
  activeTargets: Array<{ playerId: string; reason: "turn" | "chain" | "showdown" }>;
  runningSince: number | null;
  serverNow: number;
  receivedAt?: number;                   // added client-side by hydrate
}

/* ------------------------------------------------------------------ log */

/** Gameplay log entry (match log). Text is canonical English, localized client-side. */
export interface GameplayLogEntry {
  id: string;
  at: number;
  text: string;
  authorPlayerId?: string;
  turnNumber?: number;
  turnPlayerId?: string;
  actionKind?:
    | "turn" | "inspect" | "draw" | "deck" | "trash" | "resource"
    | "board" | "spell" | "battle" | "score" | "legend-xp" | "rewind" | "forward";
}

/* ------------------------------------------------------------------ room */

export interface RoomPlayer {
  id: string;
  seat: number;                          // 0..3
  name: string;
  joinedAt: number;
  leftAt?: number;
  leftReason?: "manual" | "returned_to_lobby";
  selectedBattlefield?: string;          // battlefield name
  selectedBattlefieldCardCode?: string;
  board?: PlayerBoard;                   // absent while spectating seat-less or pre-deal
  /** session-doc fields mirrored onto live room players (35qz5rkx7yexy.js:26880+) */
  decklistRaw?: string;
  deck?: unknown;
  submittedDeck?: { sections: DeckSections; raw: string };
  registeredDeck?: unknown;
  sealedFormatId?: string;
  sealedDraftId?: string;
  sealedPoolSections?: DeckSections;
  sealedRegisteredDeckSections?: DeckSections;
  identity?: { boardCustomization?: unknown; [k: string]: unknown };
}

/**
 * Authoritative gameplay Room (the `snapshot` of authoritative_snapshot).
 * Strict base: replay validator 03azfb7rltdws.js:1852-1965.
 * Live-only fields marked with their evidence line in 35qz5rkx7yexy.js.
 */
export interface Room {
  roomCode: string;
  createdAt: number;
  updatedAt: number;
  phase: RoomPhase;
  gameVariant?: GameVariant;
  roomMode?: RoomMode;
  teamIdByPlayerId?: Record<string, string>;
  playMode?: PlayMode;
  deckRulesMode?: DeckRulesMode;
  matchFormat?: MatchFormat;
  gameNumber?: number;
  seriesStartedAt?: number;
  winsByPlayerId?: Record<string, number>;
  gameHistoryStartedAt?: number;
  gameHistoryEndedAt?: number;
  firstPlayerId?: string;
  firstPlayerChooserId?: string;         // initiative winner picking first player
  activeTurnPlayerId?: string;
  activeTurnStep?: ActiveTurnStep;
  turnNumber?: number;
  playerTurnCounts?: Record<string, number>;
  pendingExtraTurns?: Array<{ sourceEntryId: string; playerId: string }>;
  extraTurnResumePlayerId?: string;
  initiativeRound?: number;
  initiativeRolls?: Record<string, number>;
  lastDieRoll?: DieRoll;
  recentDieRolls?: DieRoll[];
  players: RoomPlayer[];                 // 2..4
  log: GameplayLogEntry[];               // ≤ 2000 (room-embedded log)
  chainEntries: ChainEntry[];            // ≤ 20 in live engine (dz.U), ≤128 in replay format
  chainResolveVotes: string[];
  boardSettingsByPlayerId?: Record<string, BoardSettings>;
  battlefieldBrushByZone?: Partial<Record<BattlefieldZone, boolean>>;
  sharedBattlefieldToken?: SharedBattlefieldToken;
  postBeginningBattlefieldUnitPresenceByPlayer?: Record<string, BattlefieldPresenceMap>;
  beginningBattlefieldUnitPresenceByPlayer?: Record<string, BattlefieldPresenceMap>;
  battlefieldScoredThisTurnByPlayer?: Record<string, BattlefieldPresenceMap>;
  battlefieldConquerAssistExcludedZones?: BattlefieldZone[];
  pendingBattlefieldConquerAssist?: PendingBattlefieldConquerAssist;
  gameOutcome?: GameOutcome;
  bo3CompletedGames?: Bo3CompletedGame[];
  targetArrowsByPlayer?: Record<string, TargetArrow[]>;
  setupOrderVersion?: number;            // must equal 2 (965166.w) for battlefield_pick
  singlePlayerTurnOrder?: "play_first" | "play_second";
  soloSetupPending?: boolean;            // single_player: opponent seat pending
  sideboardDonePlayerIds?: string[];
  sideboardSkipRequest?: {
    requesterPlayerId?: string;
    acceptedPlayerIds: string[];
    declinedPlayerId?: string;
    championSelectionOnly?: boolean;
  };
  mulliganDonePlayerIds?: string[];
  mulliganPlaybackByPlayerId?: Record<string, {
    draws: Array<{ id: string; cardId: string; kind: "opening" | "refill"; handCountBeforeDraw: number }>;
    redrawCount?: number;
    hiddenRefillCardIds?: string[];
  }>;
  /* rewind (protocol v5) */
  rewindProtocolVersion?: 5;
  rewindablePlayerIds?: string[];
  forwardablePlayerIds?: string[];
  forwardAvailableUntil?: number;
  /* broadcast */
  broadcastDecksByPlayerId?: Record<string, unknown>;
  /* replay additions */
  testMode?: boolean;
}

/* ------------------------------------------------------------------ session doc (room shell) */

/**
 * Room shell session document — carried by room_shell_sync/room_shell_action and merged into the
 * projected room client-side (35qz5rkx7yexy.js:26880-27010). Persisted (Convex-ish "series") data.
 */
export interface RoomSessionDoc {
  roomCode: string;
  nextRoomCode?: string;
  returnLobbyRoomCode?: string;
  previousRoomCode?: string;
  createdAt: number;
  testMode?: boolean;
  manualStartRequired?: boolean;
  roomOrigin?: string;
  lifecycleRevision?: number;
  matchTermination?: { status: "completed" | "aborted" | (string & {}); reason?: "concession" | "disconnect" | (string & {}); endedAt?: number; winnerPlayerIds?: string[] };
  previousMatch?: unknown;
  lobbyReadyPlayerIds?: string[];
  roomMode?: RoomMode;
  gameVariant?: GameVariant;
  teamIdByPlayerId?: Record<string, string>;
  playMode?: PlayMode;
  deckRulesMode?: DeckRulesMode;
  matchFormat?: MatchFormat;
  setupOrderVersion?: number;
  singlePlayerTurnOrder?: "play_first" | "play_second";
  seriesId?: string;
  seriesStartedAt?: number;
  bo3CompletedGames?: number;
  gameNumber?: number;
  winsByPlayerId?: Record<string, number>;
  starterChooserPlayerId?: string;
  pendingGameResult?: { winnerByReporterPlayerId: Record<string, string>; [k: string]: unknown };
  rematchRequestedPlayerIds?: string[];
  usedBattlefieldsByPlayerId?: Record<string, string[]>;
  phase: RoomPhase;
  players: RoomPlayer[];
  log: GameplayLogEntry[];
}

/* ------------------------------------------------------------------ client store state */

/** Local UI store (0xawjzm3yjpr1.js:47584 hB) — never sent to the server. */
export interface InteractionState {
  armedAction: { kind: "none" | "equip" | "label" | "duplicate" | "transfer_control" | "play_hidden" | (string & {}); cardId?: string; from?: Zone };
  heldModes: { counterAdd: boolean; buff: boolean; target: boolean; ping: boolean };
  targetUi: { selection: unknown; promptPos: unknown; hotkeySourceKey: unknown };
  labelUi: {
    selection: unknown; dialogState: unknown; wheelState: unknown;
    promptPos: unknown; hotkeyActive: boolean; wheelOpenSource: unknown;
  };
  chainUi: { pendingResolveEntryId: string | null; queuedTargetedSpellDropArrow: unknown };
  autoPayUi: { previewCardId: string | null; inFlight: boolean };
}

/** Realtime runtime store (1w8d13szpogkp.js:481 ef). */
export interface RealtimeState {
  connectionState: "idle" | "connecting" | "open" | "closed" | "error" | (string & {});
  sessionPhase: "disconnected" | "bootstrap_required" | "resyncing" | "live" | "superseded" | (string & {});
  mutationPhase: "idle" | "pending";
  connectedPlayerIds: string[];
  hasPresenceSnapshot: boolean;
  presenceStatusByPlayerId: Record<string, "online" | "offline">;
  chatEntries: unknown[];
  chatAccess: { canSend: boolean; authorId: string | null; judgeChannels?: Array<{ callId: string; visibility: "public" | "private"; canSend: boolean }> } | null;
  chatSyncedIdentity: unknown;
  judgeCall: unknown | null;
  judgeCalls: unknown[];
  spectatorRoster: Spectator[];
  roomShellSessionDoc: RoomSessionDoc | null;
  roomShellSequence: number | null;
  authoritativeProjectedRoom: Room | null;
  authoritativeSequence: number | null;
  actionClockSnapshot: ActionClock | null;
  rewindConfirmation: RewindConfirmation | null;
  lastError: unknown;
  connectionStalled: boolean;
  authFailureReason: string | null;
  authRecovery: "reauthenticate" | "refresh_token" | "retry_verification" | null;
  authoritativeSyncVersion: number;
  recoveredCommittedClientActionIds: Set<string>;
  unsettledClientActionId: string | null;
}

export interface Spectator {
  authSubject: string;
  displayName: string;
  joinedAt: number;
  updatedAt: number;
  grantedPrivatePlayerIds: string[];
}

/** rewind_confirmation_state.confirmation (2i0ajg8a836h8.js:~745). */
export interface RewindConfirmation {
  requestId: string;
  requesterPlayerId: string;
  approverPlayerId: string;
  approverPlayerIds?: string[];          // multiplayer: all eligible approvers
  opponentMeaningfulActionCount: number;
  requestedAt: number;
  expiresAt: number;
}

/** Client session object (uU/uz in 35qz5rkx7yexy.js:25344). */
export interface SimSession {
  roomCode: string;
  playerId: string;
  playerName: string;
  activePlayerId: string;                // which seat this client currently controls (solo_lab)
  controlledPlayerIds: string[];
  viewerRole: ViewerRole;
  spectatorName?: string;
  playMode: PlayMode;
  deckRulesMode: DeckRulesMode;
  lastKnownPhase?: RoomPhase;
  deckName?: string;
  savedDeckId?: string;
  sealedDraftId?: string;
  sealedFormatId?: string;
  judgeCallId?: string;
  judgeChatUnavailable?: boolean;
}

/* ------------------------------------------------------------------ variant table */

/** 509396.r — exact table values. */
export interface VariantRules {
  id: GameVariant;
  label: string;                         // Duel | Skirmish | War | Magma Chamber
  shortLabel: string;                    // 1v1 | 1v1v1 | 1v1v1v1 | 2v2
  formation: "duel" | "free_for_all" | "teams";
  playerCount: 2 | 3 | 4;
  opponentsPerPlayer: 1 | 2 | 3;
  teammatesPerPlayer: 0 | 1;
  victoryScore: 8 | 11;
  scoreScope: "player" | "team";
  initialBattlefieldCount: 2 | 3;
  battlefieldContributorPolicy: "every_player" | "all_except_first_player";
  battlefieldsBroughtPerPlayer: 3;
  selectedBattlefieldsPerContributor: 1;
  turnOrderPolicy: "clockwise" | "alternate_teams";
  matchFormat: "bo1";
  firstPlayerSkipsFirstDraw: boolean;    // true except duel
  lastPlayerExtraRunesOnFirstChannel: 1;
  showdownFocusParticipants: "all_players";
  chainPriorityParticipants: "all_players";
  combatPlayerLimit: 2;
  thirdPartyCombatEntryAllowed: false;
  victoryCheckTiming: "cleanup";
  victoryRequiresStrictLead: true;
  baronAddsBattlefield: true;
  teamRules?: {
    teamSize: 2; scoreShared: true; xpShared: false; controlShared: false;
    friendlyIncludesTeammate: true; beginningStepAllyControlBlocksTeamScoring: true;
    finalConquerExcludesBeginningStepAllyBattlefields: true;
    teammatePrivateInformationMayBeShown: true; duplicateChampionLegendAllowed: false;
    duplicateBattlefieldNamesAllowed: false; winLossAndConcessionShared: true;
  };
}
