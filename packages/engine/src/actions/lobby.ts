/**
 * Lobby room-shell actions (phase "lobby"), ported from the client callbacks and the
 * room-shell contract (35qz5rkx7yexy.js:34560-34880, 36620-36760).
 */
import type { DeckSections, GameVariant, MatchFormat, PlayMode, Room, RoomPlayer } from "@rift/protocol";
import type { ActionHandler } from "../types";
import { parseDecklist } from "../rules/decklist";
import { getCardByCode, getCardByName } from "../catalog";
import { setupCards } from "../state/init";
import { emptyBoard } from "../state/board";
import { VARIANT_RULES, variantForRoom } from "../state/variant";
import { logDraft } from "../log/entries";
import { bool, int, str } from "./common";
import { deckSectionsFor, seedBoard, shuffleBoardDecks } from "./setup";
import { firstSetupPhase } from "../state/phases";

function isLobby(room: Room): boolean {
  return room.phase === "lobby";
}

function isHost(room: Room, playerId: string): boolean {
  return !room.hostPlayerId || room.hostPlayerId === playerId;
}

function log(context: Parameters<ActionHandler>[0]["context"], key: string, params?: Record<string, string | number>, actor?: string): void {
  context.log(logDraft(key, params, { ...(actor ? { authorPlayerId: actor } : {}), actionKind: "turn", at: context.now }));
}

/** orig: C1 "set_lobby_ready" */
export const setLobbyReady: ActionHandler = ({ room, player, action, context }) => {
  if (!isLobby(room)) return;
  const ready = bool(action.ready);
  const ids = new Set(room.lobbyReadyPlayerIds ?? []);
  if (ready === ids.has(player.id)) return;
  if (ready) ids.add(player.id);
  else ids.delete(player.id);
  room.lobbyReadyPlayerIds = [...ids];
  log(context, ready ? "isReady" : "isNoLongerReady", undefined, player.id);
};

/** orig: C1 "switch_lobby_seat" */
export const switchLobbySeat: ActionHandler = ({ room, player, action, context }) => {
  if (!isLobby(room)) return;
  const targetSeat = int(action.targetSeat);
  if (targetSeat < 0 || targetSeat > 3 || targetSeat === player.seat) return;
  const occupant = room.players.find((candidate) => candidate.seat === targetSeat);
  const moving = room.players.find((candidate) => candidate.id === player.id);
  if (!moving) return;
  if (occupant && occupant.id !== moving.id) occupant.seat = moving.seat;
  moving.seat = targetSeat;
  room.players.sort((a, b) => a.seat - b.seat);
  log(context, "movedToSeat", { seat: targetSeat + 1 }, player.id);
};

/** orig: C1 "randomize_lobby_teams" */
export const randomizeLobbyTeams: ActionHandler = ({ room, player, context }) => {
  if (!isLobby(room) || variantForRoom(room) !== "teams_2v2" || !isHost(room, player.id)) return;
  const ids = room.players.filter((candidate) => !candidate.leftAt).map((candidate) => candidate.id);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(context.rng() * (index + 1));
    const a = ids[index];
    const b = ids[swap];
    if (a !== undefined && b !== undefined) {
      ids[index] = b;
      ids[swap] = a;
    }
  }
  const teams: Record<string, string> = {};
  ids.forEach((id, index) => {
    teams[id] = `team:${index % 2}`;
  });
  room.teamIdByPlayerId = teams;
  log(context, "randomizedTeams", undefined, player.id);
};

/** orig: C1 "set_lobby_play_mode" */
export const setLobbyPlayMode: ActionHandler = ({ room, player, action, context }) => {
  if (!isLobby(room) || !isHost(room, player.id)) return;
  const playMode: PlayMode = action.playMode === "sealed" ? "sealed" : "constructed";
  if (room.playMode === playMode) return;
  room.playMode = playMode;
  if (playMode === "sealed") room.deckRulesMode = "standard";
  log(context, "changedGameType", { format: playMode }, player.id);
};

/** orig: C1 "set_lobby_deck_rules" */
export const setLobbyDeckRules: ActionHandler = ({ room, player, action, context }) => {
  if (!isLobby(room) || !isHost(room, player.id)) return;
  const mode = action.mode === "unrestricted" ? "unrestricted" : "standard";
  if (room.deckRulesMode === mode) return;
  room.deckRulesMode = mode;
  log(context, "changedDeckRules", { format: mode }, player.id);
};

/** orig: C1 "set_lobby_game_variant" */
export const setLobbyGameVariant: ActionHandler = ({ room, player, action, context }) => {
  if (!isLobby(room) || !isHost(room, player.id)) return;
  const variant = action.gameVariant as GameVariant;
  if (!(variant in VARIANT_RULES)) return;
  if (room.gameVariant === variant) return;
  if (VARIANT_RULES[variant].playerCount !== room.players.length) return;
  room.gameVariant = variant;
  if (variant !== "teams_2v2") room.teamIdByPlayerId = undefined;
  log(context, "changedGameType", { format: VARIANT_RULES[variant].label }, player.id);
};

/** orig: C1 "set_lobby_match_format" */
export const setLobbyMatchFormat: ActionHandler = ({ room, player, action, context }) => {
  if (!isLobby(room) || !isHost(room, player.id)) return;
  const format: MatchFormat = action.matchFormat === "bo3" ? "bo3" : "bo1";
  if (room.matchFormat === format) return;
  room.matchFormat = format;
  log(context, "changedRoomFormat", { format }, player.id);
};

/** orig: C1 "start_lobby_match" */
export const startLobbyMatch: ActionHandler = ({ room, player, context }) => {
  if (!isLobby(room) || !isHost(room, player.id)) return;
  for (const candidate of room.players) {
    const seeded = seedBoard(candidate) ?? (candidate.board ? null : emptyBoard());
    if (!seeded) continue;
    shuffleBoardDecks(seeded, context.rng);
    candidate.board = seeded;
    delete candidate.selectedBattlefield;
    delete candidate.selectedBattlefieldCardCode;
  }
  room.phase = firstSetupPhase(room);
  room.gameHistoryStartedAt = context.now;
  room.seriesStartedAt = room.seriesStartedAt ?? context.now;
  room.winsByPlayerId = room.winsByPlayerId ?? Object.fromEntries(room.players.map((candidate) => [candidate.id, 0]));
  log(context, room.roomMode === "single_player" ? "startedSinglePlayer" : "startedMatch", undefined, player.id);
};

/** orig: C1 "submit_deck" */
export const submitDeck: ActionHandler = ({ room, player, action, context }) => {
  if (!isLobby(room) || room.playMode === "sealed") return;
  const raw = str(action.decklist);
  if (!raw.trim()) return;
  const parsed = parseDecklist(raw);
  player.decklistRaw = raw;
  player.deck = parsed;
  player.registeredDeck = parsed;
  room.lobbyReadyPlayerIds = (room.lobbyReadyPlayerIds ?? []).filter((id) => id !== player.id);
  log(context, "submittedDeck", {
    cards: (parsed.totals?.mainDeck ?? 0) + (parsed.totals?.champion ?? 0),
    battlefields: parsed.totals?.battlefields ?? 0,
  }, player.id);
};

/** orig: C1 "submit_sealed_draft" */
export const submitSealedDraft: ActionHandler = ({ room, player, action, context }) => {
  if (!isLobby(room) || room.playMode !== "sealed") return;
  const draftId = str(action.draftId).trim();
  if (!draftId) return;
  player.sealedDraftId = draftId;
  const registration = action.sealedRegistration as
    | { formatId?: string; sealedRegistration?: { formatId?: string } }
    | undefined;
  const formatId = registration?.formatId ?? registration?.sealedRegistration?.formatId;
  if (typeof formatId === "string") player.sealedFormatId = formatId;
  room.lobbyReadyPlayerIds = (room.lobbyReadyPlayerIds ?? []).filter((id) => id !== player.id);
  log(context, "selectedRegistration", { format: "sealed" }, player.id);
};

/** orig: C1 "add_solo_opponent" (single_player / goldfish seat) */
export const addSoloOpponent: ActionHandler = ({ room, player, action, context }) => {
  if (!isHost(room, player.id) || room.roomMode !== "single_player" || room.soloSetupPending !== true) return;
  if (room.phase !== "sideboarding" && room.phase !== "battlefield_pick") return;
  const existingOpponents = room.players.filter((candidate) => candidate.id !== player.id && !!candidate.board);
  if (existingOpponents.length > 0 || room.players.length >= 4) return;
  const occupied = new Set(room.players.map((candidate) => candidate.seat));
  const opponentSeat =
    room.players.find((candidate) => candidate.id !== player.id)?.seat ??
    [0, 1, 2, 3].find((seat) => !occupied.has(seat)) ??
    1;
  const raw = str(action.decklist);
  const parsed = raw.trim() ? parseDecklist(raw) : null;
  const opponent: RoomPlayer = {
    id: `${player.id}:opponent`,
    seat: opponentSeat,
    name: "Test Opponent",
    joinedAt: context.now,
    ...(parsed ? { decklistRaw: raw, deck: parsed, registeredDeck: parsed } : {}),
    ...(parsed ? { submittedDeck: { sections: parsed.sections, raw } } : {}),
    battlefieldOptions: parsed ? parsed.sections.battlefields.map((entry) => entry.name) : [],
    battlefieldOptionCount: parsed ? parsed.sections.battlefields.length : 0,
  };
  if (parsed) {
    const seeded = seedBoard(opponent);
    if (seeded) shuffleBoardDecks(seeded, context.rng);
    opponent.board = seeded ?? undefined;
  }
  room.players.push(opponent);
  room.players.sort((a, b) => a.seat - b.seat);
  log(context, "filledOpponentSeat", undefined, player.id);
};

export { getCardByCode, getCardByName, setupCards, deckSectionsFor };
export type { DeckSections };
