/**
 * Setup-phase room-shell actions (sideboarding → battlefield pick → initiative →
 * first-player choice → mulligan → in_game) and BO3 result actions.
 *
 * The original server code is not shipped; these implementations follow the observable
 * client contract (`35qz5rkx7yexy.js:36620-36760`, 38600-39010), the English game-log
 * catalogue, and the setup state machine in the spec. Gameplay transitions are exact ports.
 */
import type {
  BattlefieldZone,
  DeckSections,
  DecklistEntry,
  PlayerBoard,
  Room,
  RoomPlayer,
} from "@rift/protocol";
import type { ActionHandler } from "../types";
import { setupCards } from "../state/init";
import { parseDecklist } from "../rules/decklist";
import {
  battlefieldZones,
  cloneCard,
  emptyBoard,
  isTokenOrDuplicate,
  shuffleIds,
  zoneList,
} from "../state/board";
import {
  battlefieldContributorIds,
  entityGroups,
  turnOrderForRoom,
  VARIANT_RULES,
  variantForRoom,
} from "../state/variant";
import {
  battlefieldCount,
  boardSettingsByPlayer,
  normalizeBoardSettings,
  playerIndexById,
} from "../state/selectors";
import { startTurn } from "../rules/turn";
import {
  beginningAdjustments,
  battlefieldOwnerByZone,
  normalizeBattlefieldName,
  victoryScoreForRoom,
} from "../rules/victory";
import { firstSetupPhase, phaseAfterSideboarding } from "../state/phases";
import { logDraft } from "../log/entries";
import { deepClone } from "../state/board";
import { restoreRoom, bool, int, str } from "./common";
import { getCardByCode, getCardByName } from "../catalog";

export function deckSectionsFor(player: RoomPlayer): DeckSections | null {
  if (player.submittedDeck?.sections) return player.submittedDeck.sections;
  const deck = player.deck as { sections?: DeckSections } | undefined;
  if (deck?.sections) return deck.sections;
  if (player.sealedRegisteredDeckSections) return player.sealedRegisteredDeckSections;
  return null;
}

export function seedBoard(player: RoomPlayer): PlayerBoard | null {
  const sections = deckSectionsFor(player);
  if (!sections) return null;
  return {
    ...emptyBoard(),
    deck: setupCards(sections.mainDeck, player.id, "mainDeck", player.joinedAt),
    champion: setupCards(sections.champion, player.id, "champion", player.joinedAt),
    legend: setupCards(sections.legend.slice(0, 1), player.id, "legend", player.joinedAt),
    runeDeck: setupCards(sections.runes, player.id, "rune", player.joinedAt),
  };
}

/** Shuffle a freshly seeded board's main/rune decks with the caller's RNG. */
export function shuffleBoardDecks(board: PlayerBoard, rng: () => number): void {
  board.deck = shuffleIds(board.deck, { random: rng });
  board.runeDeck = shuffleIds(board.runeDeck, { random: rng });
}

export function seedBoards(room: Room): void {
  for (const player of room.players) {
    if (!player.board) player.board = seedBoard(player) ?? undefined;
    else if (!player.board.hand.length) {
      const sections = deckSectionsFor(player);
      if (sections) player.board = seedBoard(player) ?? player.board;
    }
  }
}

function activePlayers(room: Room): RoomPlayer[] {
  return room.players.filter((player) => !!player.board && !player.leftAt);
}

function activeIds(room: Room): string[] {
  return activePlayers(room).map((player) => player.id);
}

function clearBattlefieldSelections(room: Room): void {
  for (const player of room.players) {
    delete player.selectedBattlefield;
    delete player.selectedBattlefieldCardCode;
  }
}

function startInitiative(room: Room): void {
  room.phase = "initiative_roll";
  room.initiativeRound = Math.max(1, room.initiativeRound ?? 0);
  room.initiativeRolls = {};
}

function logPhasePrompt(room: Room, context: Parameters<ActionHandler>[0]["context"]): void {
  if (room.phase === "initiative_roll") {
    const count = activePlayers(room).length;
    context.log(
      logDraft(count <= 2 ? "battlefieldsLockedRollD20" : "playerInitiativeSetup", {
        format: VARIANT_RULES[variantForRoom(room)].label,
        count,
      }, { actionKind: "turn", at: context.now }),
    );
  } else if (room.phase === "first_player_choice") {
    context.log(
      logDraft(
        room.roomMode === "single_player" ? "chooseTurnOrderThenMulligan" : "chooseSoloFirstSeat",
        undefined,
        { actionKind: "turn", at: context.now },
      ),
    );
  }
}

function mulliganCount(room: Room): number {
  return activePlayers(room).length;
}

function pluralBoth(room: Room): boolean {
  return mulliganCount(room) <= 2;
}

/** Draw opening hands (4) and initialise the playback record. */
export function enterMulliganPhase(room: Room, context: Parameters<ActionHandler>[0]["context"]): void {
  room.phase = "mulligan";
  room.mulliganDonePlayerIds = [];
  room.mulliganPlaybackByPlayerId = {};
  for (const player of room.players) {
    const board = player.board;
    if (!board) continue;
    board.hand = [];
    const draws: Array<{ id: string; cardId: string; kind: "opening" | "refill"; handCountBeforeDraw: number }> = [];
    for (let i = 0; i < 4; i += 1) {
      const card = board.deck.pop();
      if (!card) break;
      if (isTokenOrDuplicate(card)) continue;
      const before = board.hand.length;
      board.hand.push(card);
      draws.push({ id: context.idFactory("mulligan"), cardId: card.id, kind: "opening", handCountBeforeDraw: before });
    }
    room.mulliganPlaybackByPlayerId![player.id] = { draws, redrawCount: 0 };
  }
  void context;
}

/** Enter `in_game` and start the first player's turn. */
export function beginGame(room: Room, context: Parameters<ActionHandler>[0]["context"]): void {
  room.phase = "in_game";
  room.mulliganDonePlayerIds = [...new Set([...(room.mulliganDonePlayerIds ?? []), ...activeIds(room)])];
  room.turnNumber = 1;
  room.playerTurnCounts = Object.fromEntries(room.players.map((player) => [player.id, 0]));
  const firstIndex = room.players.findIndex((player) => player.id === room.firstPlayerId && !!player.board && !player.leftAt);
  const startIndex = firstIndex >= 0 ? firstIndex : room.players.findIndex((player) => !!player.board && !player.leftAt);
  if (!room.firstPlayerId && startIndex >= 0) room.firstPlayerId = room.players[startIndex]?.id;
  context.log(
    logDraft(mulliganCount(room) <= 2 ? "bothMulligansComplete" : "allMulligansComplete", undefined, {
      actionKind: "turn",
      at: context.now,
    }),
  );
  if (startIndex >= 0) startTurn(room, startIndex, context.log);
}

function nextSetupPhaseAfterBattlefields(room: Room, context: Parameters<ActionHandler>[0]["context"]): void {
  const contributors = battlefieldContributorIds(room);
  const selected = contributors.every((id) => !!room.players.find((player) => player.id === id)?.selectedBattlefield);
  if (!selected) return;
  if (!room.firstPlayerId) {
    if (room.roomMode === "multiplayer") {
      room.phase = "initiative_roll";
      room.initiativeRound = Math.max(1, room.initiativeRound ?? 0);
      room.initiativeRolls = {};
      const count = activePlayers(room).length;
      context.log(
        logDraft(count <= 2 ? "battlefieldsLockedRollD20" : "playerInitiativeSetup", {
          format: VARIANT_RULES[variantForRoom(room)].label,
          count,
        }, { actionKind: "turn", at: context.now }),
      );
    } else {
      room.phase = "first_player_choice";
      context.log(
        logDraft(room.roomMode === "single_player" ? "chooseTurnOrderThenMulligan" : "chooseSoloFirstSeat", undefined, {
          actionKind: "turn",
          at: context.now,
        }),
      );
    }
    return;
  }
  enterMulliganPhase(room, context);
}

function autoSelectLastBattlefields(room: Room, context: Parameters<ActionHandler>[0]["context"]): void {
  const contributors = battlefieldContributorIds(room);
  const selectedNames = new Set(
    room.players
      .filter((player) => contributors.includes(player.id) && player.selectedBattlefield)
      .map((player) => player.selectedBattlefield!.trim().toLowerCase()),
  );
  for (const playerId of contributors) {
    const player = room.players.find((candidate) => candidate.id === playerId);
    if (!player || player.selectedBattlefield) continue;
    const options = player.battlefieldOptions ?? [];
    const unused = options.filter((name) => !selectedNames.has(name.trim().toLowerCase()));
    if (unused.length !== 1) continue;
    const name = unused[0];
    if (!name) continue;
    player.selectedBattlefield = name.trim();
    const card = getCardByName(name);
    if (card?.id) player.selectedBattlefieldCardCode = card.id;
    selectedNames.add(name.trim().toLowerCase());
    context.log(
      logDraft("autoSelectedLastBattlefield", undefined, {
        authorPlayerId: player.id,
        actionKind: "turn",
        at: context.now,
      }),
    );
  }
}

/* ------------------------------------------------------------------ sideboarding */

/** orig: C2 "submit_sideboard" */
export const submitSideboard: ActionHandler = ({ room, player, action, context }) => {
  if (room.phase !== "sideboarding" || (room.sideboardDonePlayerIds ?? []).includes(player.id)) return;
  const legend = Array.isArray(action.legend) ? (action.legend as DecklistEntry[]) : undefined;
  const champion = Array.isArray(action.champion) ? (action.champion as DecklistEntry[]) : [];
  const mainDeck = Array.isArray(action.mainDeck) ? (action.mainDeck as DecklistEntry[]) : [];
  const sideboard = Array.isArray(action.sideboard) ? (action.sideboard as DecklistEntry[]) : [];
  const existing = deckSectionsFor(player);
  const sections: DeckSections = {
    legend: legend ?? existing?.legend ?? [],
    champion,
    mainDeck,
    battlefields: existing?.battlefields ?? [],
    runes: existing?.runes ?? [],
    sideboard,
  };
  player.submittedDeck = { sections, raw: player.submittedDeck?.raw ?? player.decklistRaw ?? "" };
  const seeded = seedBoard(player) ?? player.board;
  if (seeded) shuffleBoardDecks(seeded, context.rng);
  player.board = seeded;
  room.sideboardDonePlayerIds = [...new Set([...(room.sideboardDonePlayerIds ?? []), player.id])];
  const allDone = activePlayers(room).every((candidate) =>
    (room.sideboardDonePlayerIds ?? []).includes(candidate.id),
  );
  context.log(logDraft("updatedSideboarding", undefined, { authorPlayerId: player.id, actionKind: "turn", at: context.now }));
  if (!allDone) return;
  room.sideboardSkipRequest = undefined;
  clearBattlefieldSelections(room);
  room.phase = phaseAfterSideboarding(room);
  if (room.phase === "initiative_roll") {
    startInitiative(room);
    logPhasePrompt(room, context);
  } else if (room.phase === "first_player_choice") {
    logPhasePrompt(room, context);
  } else {
    context.log(
      logDraft(
        pluralBoth(room) ? "bothSideboardsLockedChooseBattlefield" : "allBattlefieldsLockedSideboard",
        { count: battlefieldCount(room) },
        { actionKind: "turn", at: context.now },
      ),
    );
  }
};

/** orig: C2 "request_sideboard_skip" */
export const requestSideboardSkip: ActionHandler = ({ room, player, context }) => {
  if (room.phase !== "sideboarding" || room.sideboardSkipRequest) return;
  if (room.roomMode !== "multiplayer" || room.matchFormat === "bo3" || room.playMode === "sealed") return;
  room.sideboardSkipRequest = { requesterPlayerId: player.id, acceptedPlayerIds: [] };
  context.log(logDraft("requestedSkipSideboarding", undefined, { authorPlayerId: player.id, actionKind: "turn", at: context.now }));
};

function applySideboardSkip(room: Room, context: Parameters<ActionHandler>[0]["context"]): void {
  for (const player of room.players) {
    if (!player.board) continue;
    const sections = deckSectionsFor(player);
    if (sections) {
      const seeded = seedBoard(player) ?? player.board;
      shuffleBoardDecks(seeded, context.rng);
      player.board = seeded;
    }
    player.submittedDeck = {
      sections:
        sections ??
        player.submittedDeck?.sections ?? {
          legend: [],
          champion: [],
          mainDeck: [],
          battlefields: [],
          runes: [],
          sideboard: [],
        },
      raw: player.submittedDeck?.raw ?? "",
    };
  }
  room.sideboardDonePlayerIds = room.players.map((player) => player.id);
  room.sideboardSkipRequest = undefined;
  clearBattlefieldSelections(room);
  room.phase = phaseAfterSideboarding(room);
  if (room.phase === "initiative_roll") startInitiative(room);
  logPhasePrompt(room, context);
  if (room.phase === "battlefield_pick") {
    context.log(
      logDraft(
        "allSkippedSideboardingChooseBattlefields",
        undefined,
        { actionKind: "turn", at: context.now },
      ),
    );
  }
}

/** orig: C2 "respond_sideboard_skip" */
export const respondSideboardSkip: ActionHandler = ({ room, player, action, context }) => {
  const request = room.sideboardSkipRequest;
  if (room.phase !== "sideboarding" || !request || request.declinedPlayerId || request.championSelectionOnly) return;
  const response = str(action.response);
  if (response === "cancel") {
    if (request.requesterPlayerId !== player.id) return;
    room.sideboardSkipRequest = undefined;
    context.log(logDraft("canceledSkipSideboarding", undefined, { authorPlayerId: player.id, actionKind: "turn", at: context.now }));
    return;
  }
  if (response === "decline") {
    if (request.requesterPlayerId === player.id) return;
    room.sideboardSkipRequest = { ...request, declinedPlayerId: player.id };
    context.log(logDraft("declinedSkipSideboarding", undefined, { authorPlayerId: player.id, actionKind: "turn", at: context.now }));
    return;
  }
  if (response !== "accept" || request.requesterPlayerId === player.id) return;
  if (request.acceptedPlayerIds.includes(player.id)) return;
  const accepted = [...request.acceptedPlayerIds, player.id];
  const others = activePlayers(room).filter((candidate) => candidate.id !== request.requesterPlayerId);
  const allAccepted = others.every((candidate) => accepted.includes(candidate.id));
  room.sideboardSkipRequest = { ...request, acceptedPlayerIds: accepted };
  context.log(logDraft("acceptedSkipSideboarding", undefined, { authorPlayerId: player.id, actionKind: "turn", at: context.now }));
  if (allAccepted) applySideboardSkip(room, context);
};

/* ------------------------------------------------------------------ battlefield pick */

/** orig: C2 "select_battlefield" */
export const selectBattlefield: ActionHandler = ({ room, player, action, context }) => {
  if (room.phase !== "battlefield_pick" || room.setupOrderVersion !== 2) return;
  if (player.selectedBattlefield) return;
  if (!battlefieldContributorIds(room).includes(player.id)) return;
  const options = player.battlefieldOptions ?? [];
  if (options.length === 0) return;
  const selectedNames = new Set(
    room.players.filter((candidate) => candidate.selectedBattlefield).map((candidate) => candidate.selectedBattlefield!.trim().toLowerCase()),
  );
  const available = options.filter((name) => !selectedNames.has(name.trim().toLowerCase()));
  const random = bool(action.random);
  const requested = random ? undefined : str(action.battlefield).trim();
  const chosen = random ? available[Math.floor(context.rng() * available.length)] : requested;
  if (!chosen || !available.includes(chosen)) return;
  player.selectedBattlefield = chosen.trim();
  const card = getCardByName(chosen);
  if (card?.id) player.selectedBattlefieldCardCode = card.id;
  context.log(
    logDraft(random ? "lockedRandomBattlefield" : "lockedBattlefield", undefined, {
      authorPlayerId: player.id,
      actionKind: "turn",
      at: context.now,
    }),
  );
  autoSelectLastBattlefields(room, context);
  nextSetupPhaseAfterBattlefields(room, context);
};

/* ------------------------------------------------------------------ initiative / first player */

/** orig: C2 "roll_initiative" */
export const rollInitiative: ActionHandler = ({ room, player, context }) => {
  if (room.phase !== "initiative_roll") return;
  if (!player.board || player.leftAt) return;
  const variant = variantForRoom(room);
  const groups = entityGroups({
    variant,
    playerIdsInSeatOrder: room.players.map((candidate) => candidate.id),
    teamIdByPlayerId: room.teamIdByPlayerId,
  });
  const playerEntity =
    variant === "teams_2v2"
      ? groups.find((entity) => entity.playerIds.includes(player.id))
      : undefined;
  const rollKey = playerEntity?.id ?? player.id;
  if (room.initiativeRolls?.[rollKey] !== undefined) return;
  room.initiativeRound = Math.max(1, room.initiativeRound ?? 0);
  const result = Math.floor(context.rng() * 20) + 1;
  room.initiativeRolls = { ...(room.initiativeRolls ?? {}), [rollKey]: result };
  context.log(
    logDraft("rolledD20By", { competitor: player.name }, {
      actionKind: "turn",
      at: context.now,
    }),
  );
  const competitors =
    variant === "teams_2v2"
      ? groups
          .map((entity) => {
            const members = entity.playerIds
              .map((id) => room.players.find((candidate) => candidate.id === id))
              .filter((candidate): candidate is RoomPlayer => !!candidate?.board && !candidate.leftAt);
            return members.length > 0 ? { id: entity.id, representative: members[0]!, name: members[0]!.name } : null;
          })
          .filter((entry): entry is { id: string; representative: RoomPlayer; name: string } => !!entry)
      : activePlayers(room).map((candidate) => ({
          id: candidate.id,
          representative: candidate,
          name: candidate.name,
        }));
  if (!competitors.every((entry) => room.initiativeRolls?.[entry.id] !== undefined)) return;
  const rolls = competitors.map((entry) => ({
    entry,
    value: room.initiativeRolls?.[entry.id] ?? 0,
  }));
  const high = Math.max(...rolls.map((entry) => entry.value));
  const winners = rolls.filter((entry) => entry.value === high);
  if (winners.length !== 1) {
    room.initiativeRound = (room.initiativeRound ?? 0) + 1;
    room.initiativeRolls = {};
    return;
  }
  const winner = winners[0];
  if (!winner) return;
  const low = Math.min(...rolls.map((entry) => entry.value));
  room.firstPlayerChooserId = winner.entry.representative.id;
  room.phase = "first_player_choice";
  context.log(
    logDraft("competitorWonInitiative", {
      competitor: winner.entry.name,
      high,
      low,
    }, { actionKind: "turn", at: context.now }),
  );
};

/** orig: C2 "choose_first_player" */
export const chooseFirstPlayer: ActionHandler = ({ room, player, action, context }) => {
  if (room.phase !== "first_player_choice") return;
  if (room.firstPlayerChooserId && room.firstPlayerChooserId !== player.id) {
    const sameEntity = entityGroups({
      variant: variantForRoom(room),
      playerIdsInSeatOrder: room.players.map((candidate) => candidate.id),
      teamIdByPlayerId: room.teamIdByPlayerId,
    }).some(
      (entity) =>
        entity.playerIds.includes(room.firstPlayerChooserId!) && entity.playerIds.includes(player.id),
    );
    if (!sameEntity) return;
  }
  const chosenId = str(action.firstPlayerId);
  const chosen = room.players.find((candidate) => candidate.id === chosenId && !!candidate.board && !candidate.leftAt);
  if (!chosen) return;
  room.firstPlayerId = chosen.id;
  const contributors = battlefieldContributorIds(room);
  const battlefieldsLocked = contributors.every((id) => !!room.players.find((candidate) => candidate.id === id)?.selectedBattlefield);
  if (!battlefieldsLocked && VARIANT_RULES[variantForRoom(room)].battlefieldContributorPolicy === "all_except_first_player") {
    room.phase = "battlefield_pick";
    context.log(
      logDraft("competitorChoseStarterBattlefields", {
        competitor: player.name,
        player: chosen.name,
      }, { actionKind: "turn", at: context.now }),
    );
    return;
  }
  context.log(
    logDraft("choseStarterMulligan", { player: chosen.name }, {
      actionKind: "turn",
      at: context.now,
    }),
  );
  enterMulliganPhase(room, context);
};

/** orig: C2 "choose_single_player_turn_order" */
export const chooseSinglePlayerTurnOrder: ActionHandler = ({ room, player, action, context }) => {
  if (room.phase !== "first_player_choice") return;
  const order = str(action.turnOrder) === "play_second" ? "play_second" : "play_first";
  room.singlePlayerTurnOrder = order;
  const opponents = activePlayers(room).filter((candidate) => candidate.id !== player.id);
  const chosen = order === "play_first" ? player : (opponents[0] ?? player);
  room.firstPlayerId = chosen.id;
  const contenders = battlefieldContributorIds(room);
  const battlefieldsLocked = contenders.every((id) => !!room.players.find((candidate) => candidate.id === id)?.selectedBattlefield);
  if (!battlefieldsLocked) {
    room.phase = "battlefield_pick";
    context.log(
      logDraft(order === "play_first" ? "goldfishFirstSideboard" : "goldfishSecondSideboard", undefined, {
        authorPlayerId: player.id,
        actionKind: "turn",
        at: context.now,
      }),
    );
    return;
  }
  context.log(
    logDraft(order === "play_first" ? "goldfishFirstMulligan" : "goldfishSecondMulligan", undefined, {
      authorPlayerId: player.id,
      actionKind: "turn",
      at: context.now,
    }),
  );
  enterMulliganPhase(room, context);
};

/* ------------------------------------------------------------------ mulligan */

/** orig: C2 "submit_mulligan" */
export const submitMulligan: ActionHandler = ({ room, player, board, action, context }) => {
  if (room.phase !== "mulligan" || (room.mulliganDonePlayerIds ?? []).includes(player.id)) return;
  const requested = Array.isArray(action.cardIds)
    ? action.cardIds.filter((id): id is string => typeof id === "string")
    : [];
  if (requested.length > 2 || new Set(requested).size !== requested.length) return;
  if (requested.some((id) => !board.hand.some((card) => card.id === id))) return;
  if (action.boardSettings && typeof action.boardSettings === "object") {
    const settings = normalizeBoardSettings(action.boardSettings as Partial<import("@rift/protocol").BoardSettings>);
    room.boardSettingsByPlayerId = { ...boardSettingsByPlayer(room), [player.id]: settings };
  }
  const playback = room.mulliganPlaybackByPlayerId?.[player.id] ?? { draws: [] };
  const draws = [...playback.draws];
  const recycled: typeof board.hand = [];
  for (const cardId of requested) {
    const index = board.hand.findIndex((card) => card.id === cardId);
    const [card] = board.hand.splice(index, 1);
    if (!card) continue;
    card.exhausted = false;
    recycled.push(card);
  }
  // "Recycle" in this engine always means bottom-of-deck in random order.
  board.deck.unshift(...shuffleIds(recycled, { random: context.rng }));
  for (let index = 0; index < recycled.length; index += 1) {
    const drawn = board.deck.pop();
    if (!drawn || isTokenOrDuplicate(drawn)) continue;
    const before = board.hand.length;
    board.hand.push(drawn);
    draws.push({ id: context.idFactory("mulligan"), cardId: drawn.id, kind: "refill", handCountBeforeDraw: before });
  }
  room.mulliganPlaybackByPlayerId = {
    ...(room.mulliganPlaybackByPlayerId ?? {}),
    [player.id]: { draws, redrawCount: recycled.length },
  };
  room.mulliganDonePlayerIds = [...new Set([...(room.mulliganDonePlayerIds ?? []), player.id])];
  context.log(
    logDraft("finalizedMulligan", { recycled: requested.length, redrawn: requested.length }, {
      authorPlayerId: player.id,
      actionKind: "turn",
      at: context.now,
    }),
  );
  const allDone = activePlayers(room).every((candidate) =>
    (room.mulliganDonePlayerIds ?? []).includes(candidate.id),
  );
  if (allDone) beginGame(room, context);
};

/** orig: C2 "confirm_solo_setup" */
export const confirmSoloSetup: ActionHandler = ({ room, player, context }) => {
  if (room.roomMode !== "single_player" || room.soloSetupPending !== true) return;
  if (room.phase !== "sideboarding" && room.phase !== "battlefield_pick") return;
  room.soloSetupPending = false;
  void player;
  void context;
};

/* ------------------------------------------------------------------ auto test setup */

/** orig: C2 "auto_start_test_setup" */
export const autoStartTestSetup: ActionHandler = ({ room, player, context }) => {
  if (room.hostPlayerId && room.hostPlayerId !== player.id) return;
  if (!["sideboarding", "battlefield_pick", "initiative_roll", "first_player_choice", "mulligan"].includes(room.phase)) return;
  const backup = deepClone(room);
  try {
    for (let pass = 0; pass < 6 && room.phase !== "in_game"; pass += 1) {
      if (room.phase === "sideboarding") {
        for (const candidate of activePlayers(room)) {
          const sections = deckSectionsFor(candidate);
          candidate.submittedDeck =
            candidate.submittedDeck ?? (sections ? { sections, raw: candidate.decklistRaw ?? "" } : undefined);
        }
        room.sideboardDonePlayerIds = activePlayers(room).map((candidate) => candidate.id);
        clearBattlefieldSelections(room);
        room.phase = phaseAfterSideboarding(room);
        if (room.phase === "initiative_roll") startInitiative(room);
        continue;
      }
      if (room.phase === "battlefield_pick") {
        pickRandomBattlefields(room, context);
        if (!battlefieldContributorsLocked(room)) {
          if (!room.firstPlayerId) {
            room.phase = room.roomMode === "multiplayer" ? "initiative_roll" : "first_player_choice";
            if (room.phase === "initiative_roll") startInitiative(room);
          }
          continue;
        }
        if (!room.firstPlayerId) {
          room.phase = room.roomMode === "multiplayer" ? "initiative_roll" : "first_player_choice";
          if (room.phase === "initiative_roll") startInitiative(room);
          continue;
        }
        enterMulliganPhase(room, context);
        continue;
      }
      if (room.phase === "initiative_roll") {
        for (const candidate of activePlayers(room)) {
          if (room.initiativeRolls?.[candidate.id] === undefined) {
            room.initiativeRolls = {
              ...(room.initiativeRolls ?? {}),
              [candidate.id]: Math.floor(context.rng() * 20) + 1,
            };
          }
        }
        const candidates = activePlayers(room);
        const rolls = room.initiativeRolls ?? {};
        const winner = candidates.reduce((best, candidate) => {
          if (!best) return candidate;
          return (rolls[candidate.id] ?? 0) > (rolls[best.id] ?? 0) ? candidate : best;
        }, null as RoomPlayer | null);
        room.firstPlayerChooserId = winner?.id ?? candidates[0]?.id;
        room.firstPlayerId = room.firstPlayerChooserId;
        room.phase = "battlefield_pick";
        continue;
      }
      if (room.phase === "first_player_choice") {
        room.firstPlayerId =
          room.roomMode === "single_player"
            ? player.id
            : (activePlayers(room)[0]?.id ?? player.id);
        room.phase = "battlefield_pick";
        continue;
      }
      if (room.phase === "mulligan") {
        room.mulliganDonePlayerIds = activePlayers(room).map((candidate) => candidate.id);
        beginGame(room, context);
        continue;
      }
      break;
    }
    context.log(logDraft("autoStartedTestSetup", undefined, { authorPlayerId: player.id, actionKind: "turn", at: context.now }));
  } catch {
    restoreRoom(room, backup);
  }
};

function pickRandomBattlefields(room: Room, context: Parameters<ActionHandler>[0]["context"]): void {
  for (const id of battlefieldContributorIds(room)) {
    const candidate = room.players.find((roomPlayer) => roomPlayer.id === id);
    if (!candidate || candidate.selectedBattlefield) continue;
    const options = (candidate.battlefieldOptions ?? []).filter(
      (name) =>
        !room.players.some(
          (other) => other.selectedBattlefield?.trim().toLowerCase() === name.trim().toLowerCase(),
        ),
    );
    const chosen = options[Math.floor(context.rng() * options.length)];
    if (!chosen) continue;
    candidate.selectedBattlefield = chosen;
    candidate.selectedBattlefieldCardCode = getCardByName(chosen)?.id;
  }
}

function battlefieldContributorsLocked(room: Room): boolean {
  return battlefieldContributorIds(room).every(
    (id) => !!room.players.find((candidate) => candidate.id === id)?.selectedBattlefield,
  );
}

/* ------------------------------------------------------------------ BO3 results */

/** orig: C3 "request_game_result_confirmation" */
export const requestGameResultConfirmation: ActionHandler = ({ room }) => {
  if (room.matchFormat !== "bo3" || room.phase !== "in_game") return;
  room.pendingGameResult = room.pendingGameResult ?? { winnerByReporterPlayerId: {} };
};

/** orig: C3 "cancel_game_result_confirmation" */
export const cancelGameResultConfirmation: ActionHandler = ({ room, player }) => {
  if (!room.pendingGameResult) return;
  const reports = { ...room.pendingGameResult.winnerByReporterPlayerId };
  delete reports[player.id];
  room.pendingGameResult = Object.keys(reports).length > 0 ? { winnerByReporterPlayerId: reports } : undefined;
};

/** orig: C3 "report_game_result" */
export const reportGameResult: ActionHandler = ({ room, player, action, context }) => {
  if (room.matchFormat !== "bo3" || room.phase !== "in_game") return;
  const winnerPlayerId = str(action.winnerPlayerId);
  if (!room.players.some((candidate) => candidate.id === winnerPlayerId)) return;
  const reports = { ...(room.pendingGameResult?.winnerByReporterPlayerId ?? {}), [player.id]: winnerPlayerId };
  const reporters = room.players.filter((candidate) => !!candidate.board && !candidate.leftAt);
  const agreed = reporters.every((candidate) => reports[candidate.id] === winnerPlayerId);
  room.pendingGameResult = { winnerByReporterPlayerId: reports };
  if (!agreed) return;
  room.gameOutcome = {
    winnerPlayerIds: [winnerPlayerId],
    reason: "score",
    decidedAtTurnNumber: Math.max(1, room.turnNumber ?? 1),
  };
  const wins = { ...(room.winsByPlayerId ?? {}) };
  wins[winnerPlayerId] = (wins[winnerPlayerId] ?? 0) + 1;
  room.winsByPlayerId = wins;
  const gameNumber = room.gameNumber ?? 1;
  room.bo3CompletedGames = [
    ...(room.bo3CompletedGames ?? []).filter((game) => game.gameNumber !== gameNumber),
    {
      gameNumber,
      scoresByPlayerId: Object.fromEntries(room.players.map((candidate) => [candidate.id, candidate.board?.score ?? 0])),
      durationMs: Math.max(0, context.now - (room.gameHistoryStartedAt ?? context.now)),
    },
  ];
  context.log(logDraft("startedMatch", undefined, { actionKind: "turn", at: context.now }));
};

/** orig: C3 "request_bo3_rematch" */
export const requestBo3Rematch: ActionHandler = ({ room, player }) => {
  if (room.matchFormat !== "bo3" || !room.gameOutcome) return;
  room.rematchRequestedPlayerIds = [...new Set([...(room.rematchRequestedPlayerIds ?? []), player.id])];
};

export {
  beginningAdjustments,
  battlefieldOwnerByZone,
  battlefieldZones,
  cloneCard,
  entityGroups,
  firstSetupPhase,
  getCardByCode,
  int,
  normalizeBattlefieldName,
  phaseAfterSideboarding,
  playerIndexById,
  turnOrderForRoom,
  victoryScoreForRoom,
  zoneList,
};
