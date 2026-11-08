/**
 * Per-viewer snapshot redaction.
 *
 * The authoritative room is server-private: opponents' hands, deck order, face-down cards and
 * private deck peeks must never leave the server. The client has matching defences
 * (`0xawjzm3yjpr1.js:39760-39810` builds the same `__hidden_zone__` placeholders client-side), so
 * this module mirrors their exact placeholder shape and id scheme:
 *
 *   id: "__hidden_zone__:<playerId>:<zone>:<index>"
 *   { name: "", source: "mainDeck", exhausted: false, createdAt: <index>, isPlaceholder: true }
 */

import type {
  CardInstance,
  GameplayLogEntry,
  PlayerBoard,
  RawActionClock,
  Room,
  RoomPlayer,
  Spectator,
  ViewerRole,
} from "@rift/protocol";

export const HIDDEN_ZONE_ID_PREFIX = "__hidden_zone__";

/** `862657.H` in the client bundle. */
export function hiddenZoneCardId(input: { playerId: string; zone: string; index: number }): string {
  return `${HIDDEN_ZONE_ID_PREFIX}:${input.playerId}:${input.zone}:${input.index}`;
}

/** `862657.z` in the client bundle. */
export function isHiddenZoneCardId(id: string): boolean {
  return id.startsWith(`${HIDDEN_ZONE_ID_PREFIX}:`);
}

export interface SnapshotViewer {
  /** The player seat this viewer controls (null for pure spectators). */
  playerId?: string | null;
  viewerRole?: ViewerRole;
  /** Seats this client controls (solo_lab / single_player can control both). */
  controlledPlayerIds?: string[];
  /** Spectator-only seats whose hidden information was granted to this spectator. */
  grantedPrivatePlayerIds?: string[];
  /** Signed-in subject of a spectator (used for per-card reveals / grant records). */
  spectatorAuthSubject?: string | null;
  /** True for broadcast/caster views (same visibility as an ungranted spectator). */
  broadcastView?: boolean;
}

type VisibleCardList = CardInstance[];

function cloneRoom<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function placeholderCard(playerId: string, zone: string, index: number): CardInstance {
  return {
    id: hiddenZoneCardId({ playerId, zone, index }),
    name: "",
    source: "mainDeck",
    exhausted: false,
    createdAt: index,
    isPlaceholder: true,
  };
}

function isRevealedToViewer(card: CardInstance, viewer: SnapshotViewer): boolean {
  if (card.revealedToOpponent) return true;
  const playerId = viewer.playerId ?? null;
  if (
    card.revealedToPlayerIds &&
    playerId !== null &&
    card.revealedToPlayerIds.includes(playerId)
  ) {
    return true;
  }
  return false;
}

function hideCard(
  card: CardInstance,
  playerId: string,
  zone: string,
  index: number,
  viewer: SnapshotViewer,
): CardInstance {
  if (isHiddenZoneCardId(card.id)) return card;
  if (isRevealedToViewer(card, viewer)) return card;
  return placeholderCard(playerId, zone, index);
}

function redactZone(
  cards: VisibleCardList | undefined,
  playerId: string,
  zone: string,
  viewer: SnapshotViewer,
  options: { hideAll?: boolean; hideFaceDown?: boolean } = {},
): VisibleCardList | undefined {
  if (!cards) return cards;
  if (!options.hideAll && !options.hideFaceDown) return cards;
  return cards.map((card, index) => {
    if (options.hideAll) return hideCard(card, playerId, zone, index, viewer);
    if (card.hidden) return hideCard(card, playerId, zone, index, viewer);
    return card;
  });
}

function redactBoard(
  board: PlayerBoard,
  player: RoomPlayer,
  viewer: SnapshotViewer,
  seesPrivate: boolean,
): PlayerBoard {
  if (seesPrivate) return board;

  const playerId = player.id;
  const handFullyRevealed =
    board.handRevealToOpponent === true ||
    (viewer.playerId != null &&
      Array.isArray(board.handRevealedToPlayerIds) &&
      board.handRevealedToPlayerIds.includes(viewer.playerId));

  const redacted: PlayerBoard = {
    ...board,
    deck: redactZone(board.deck, playerId, "deck", viewer, { hideAll: true }) ?? [],
    runeDeck: redactZone(board.runeDeck, playerId, "runeDeck", viewer, { hideAll: true }) ?? [],
    hand: handFullyRevealed
      ? (redactZone(board.hand, playerId, "hand", viewer, { hideFaceDown: false }) ?? [])
      : (redactZone(board.hand, playerId, "hand", viewer, { hideAll: true }) ?? []),
    base: redactZone(board.base, playerId, "base", viewer, { hideFaceDown: true }) ?? [],
    trash: redactZone(board.trash, playerId, "trash", viewer, { hideFaceDown: true }) ?? [],
    banished:
      redactZone(board.banished, playerId, "banished", viewer, { hideFaceDown: true }) ?? [],
    battlefieldA:
      redactZone(board.battlefieldA, playerId, "battlefieldA", viewer, { hideFaceDown: true }) ??
      [],
    battlefieldB:
      redactZone(board.battlefieldB, playerId, "battlefieldB", viewer, { hideFaceDown: true }) ??
      [],
    battlefieldC:
      redactZone(board.battlefieldC, playerId, "battlefieldC", viewer, { hideFaceDown: true }) ??
      [],
    battlefieldToken:
      redactZone(board.battlefieldToken, playerId, "battlefieldToken", viewer, {
        hideFaceDown: true,
      }) ?? [],
    champion:
      redactZone(board.champion, playerId, "champion", viewer, { hideFaceDown: true }) ?? [],
    legend: redactZone(board.legend, playerId, "legend", viewer, { hideFaceDown: true }) ?? [],
    runeArea:
      redactZone(board.runeArea, playerId, "runeArea", viewer, { hideFaceDown: true }) ?? [],
    // Private peek session: ids and revealed cards are owner-only information.
    deckPeek: { cardIds: [], revealedCardIds: [] },
  };

  if (board.additionalLegends) {
    redacted.additionalLegends =
      redactZone(board.additionalLegends, playerId, "additionalLegends", viewer, {
        hideFaceDown: true,
      }) ?? [];
  }
  return redacted;
}

/**
 * Redact a room for one viewer.
 *
 * - player seats see their own board in full;
 * - `controlledPlayerIds` (solo_lab / single_player) see every controlled board in full;
 * - spectators see boards of players who granted them private access (`grantedPrivatePlayerIds`);
 * - everyone else sees opponents' hands/decks as `__hidden_zone__` placeholders, no face-down card
 *   identities and no private deck-peek sessions.
 */
export function redactRoomForViewer(room: Room, viewer: SnapshotViewer): Room {
  const redacted = cloneRoom(room);
  const owned = new Set<string>();
  if (viewer.playerId) owned.add(viewer.playerId);
  for (const id of viewer.controlledPlayerIds ?? []) owned.add(id);
  for (const id of viewer.grantedPrivatePlayerIds ?? []) owned.add(id);

  redacted.players = redacted.players.map((player) => {
    if (!player.board) return player;
    if (owned.has(player.id)) return player;
    return { ...player, board: redactBoard(player.board, player, viewer, false) };
  });

  // Chain entries are public, but a face-down (Hidden) card in the chain is not.
  redacted.chainEntries = redacted.chainEntries.map((entry, index) => {
    if (!entry.card?.hidden) return entry;
    if (owned.has(entry.byPlayerId)) return entry;
    if (isRevealedToViewer(entry.card, viewer)) return entry;
    return {
      ...entry,
      card: placeholderCard(entry.byPlayerId, "chain", index),
    };
  });

  return redacted;
}

export interface SnapshotPayload {
  snapshot: Room;
  gameplayLog: GameplayLogEntry[];
  actionClock?: RawActionClock;
}

/** Redacted authoritative snapshot payload for one viewer. */
export function snapshotForViewer(
  input: {
    room: Room;
    gameplayLogEntries: GameplayLogEntry[];
    actionClock?: RawActionClock;
  },
  viewer: SnapshotViewer,
): SnapshotPayload {
  return {
    snapshot: redactRoomForViewer(input.room, viewer),
    gameplayLog: input.gameplayLogEntries,
    ...(input.actionClock ? { actionClock: input.actionClock } : {}),
  };
}

/** Viewer derived from a spectator roster record. */
export function viewerForSpectator(spectator: Spectator): SnapshotViewer {
  return {
    playerId: null,
    viewerRole: "spectator",
    grantedPrivatePlayerIds: spectator.grantedPrivatePlayerIds,
    spectatorAuthSubject: spectator.authSubject,
  };
}

/** Serialize-safe redacted state (room + log + clock). */
export function redactRuntimeStateForViewer(
  state: {
    room: Room;
    gameplayLogEntries: GameplayLogEntry[];
    actionClock?: RawActionClock;
  },
  viewer: SnapshotViewer,
): { room: Room; gameplayLogEntries: GameplayLogEntry[]; actionClock?: RawActionClock } {
  return {
    room: redactRoomForViewer(state.room, viewer),
    gameplayLogEntries: state.gameplayLogEntries,
    ...(state.actionClock ? { actionClock: state.actionClock } : {}),
  };
}
