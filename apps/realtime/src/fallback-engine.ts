/**
 * Development fallback engine.
 *
 * Used only while @rift/engine has not exported `createInitialGameState`/`applyGameAction` yet.
 * It implements the setup flow and the generic manual primitives the server needs for a playable
 * room (turn handoff, channel/draw, manual card movement, counters, chain, dice) without trying to
 * replicate card-specific rules — those live in @rift/engine.
 */

import type {
  CardInstance,
  ChainEntry,
  GameplayLogEntry,
  PlayerBoard,
  PlayerBoard as Board,
  Room,
  RoomPlayer,
  Zone,
} from "@rift/protocol";
import type {
  EngineActionContext,
  EngineActionResult,
  EngineSeatConfig,
  EngineSetupConfig,
} from "./engine-types";
import { parseDecklist } from "./decklist";

const ZONES: readonly Zone[] = [
  "deck",
  "hand",
  "base",
  "trash",
  "banished",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
  "champion",
  "legend",
  "runeDeck",
  "runeArea",
];

const VICTORY_SCORE: Record<string, number> = {
  duel: 8,
  free_for_all_3: 8,
  free_for_all_4: 8,
  teams_2v2: 11,
};

type RoomWithExtras = Room & {
  actionLogCounter?: number;
};

interface ActionRecord {
  type: string;
  [key: string]: unknown;
}

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "") || "card"
  );
}

function makeCardId(playerId: string, source: string, index: number, name: string): string {
  return `setup-${playerId}-${source}-${index}-${slug(name)}`;
}

function cardsFromEntries(
  entries: Array<{ name: string; count: number; cardCode?: string }>,
  playerId: string,
  source: string,
  createdAt: number,
): CardInstance[] {
  const cards: CardInstance[] = [];
  let index = 0;
  for (const entry of entries) {
    for (let copy = 0; copy < entry.count; copy += 1) {
      cards.push({
        id: makeCardId(playerId, source, index, entry.name),
        name: entry.name,
        source:
          source === "rune"
            ? "rune"
            : source === "champion"
              ? "champion"
              : source === "legend"
                ? "legend"
                : source === "battlefield"
                  ? "battlefield"
                  : "mainDeck",
        exhausted: false,
        createdAt,
        ownerPlayerId: playerId,
        ...(entry.cardCode ? { cardCode: entry.cardCode } : {}),
        ...(source === "rune" ? { type: "Rune" } : {}),
        ...(source === "champion" || source === "legend" ? { type: "Legend" } : {}),
        ...(source === "battlefield" ? { type: "Battlefield" } : {}),
        ...(source === "mainDeck" ? { type: "Unit" } : {}),
      });
      index += 1;
    }
  }
  return cards;
}

function emptyBoard(createdAt: number): PlayerBoard {
  return {
    score: 0,
    floatingEnergy: 0,
    floatingPower: 0,
    legendXp: 0,
    deck: [],
    hand: [],
    handRevealToOpponent: false,
    base: [],
    trash: [],
    banished: [],
    battlefieldA: [],
    battlefieldB: [],
    battlefieldC: [],
    battlefieldToken: [],
    champion: [],
    legend: [],
    runeDeck: [],
    runeArea: [],
    deckPeek: { cardIds: [], revealedCardIds: [] },
  };
}

function buildPlayer(seat: EngineSeatConfig, createdAt: number): RoomPlayer {
  const deck = seat.deck ?? parseDecklist(seat.decklist ?? "");
  const board = emptyBoard(createdAt);
  board.deck = cardsFromEntries(deck.sections.mainDeck, seat.playerId, "mainDeck", createdAt);
  board.champion = cardsFromEntries(deck.sections.champion, seat.playerId, "champion", createdAt);
  board.legend = cardsFromEntries(
    deck.sections.legend.slice(0, 1),
    seat.playerId,
    "legend",
    createdAt,
  );
  board.runeDeck = cardsFromEntries(deck.sections.runes, seat.playerId, "rune", createdAt);
  const battlefieldOptions = deck.sections.battlefields.flatMap((entry) =>
    Array.from({ length: entry.count }, () => ({
      name: entry.name,
      ...(entry.cardCode ? { cardCode: entry.cardCode } : {}),
    })),
  );
  return {
    id: seat.playerId,
    seat: seat.seat,
    name: seat.name,
    joinedAt: createdAt,
    board,
    decklistRaw: deck.raw,
    deck,
    ...({ battlefieldOptions } as Record<string, unknown>),
  };
}

export function createFallbackInitialState(config: EngineSetupConfig): Room {
  const createdAt = config.createdAt;
  const seats = [...config.players].sort((a, b) => a.seat - b.seat);
  const players = seats.map((seat) => buildPlayer(seat, createdAt));
  return {
    roomCode: config.roomCode,
    createdAt,
    updatedAt: createdAt,
    phase: "battlefield_pick",
    gameVariant: config.gameVariant,
    roomMode: config.roomMode,
    playMode: config.playMode,
    deckRulesMode: config.deckRulesMode ?? "standard",
    matchFormat: config.matchFormat,
    gameNumber: 1,
    winsByPlayerId: {},
    setupOrderVersion: 2,
    initiativeRound: 1,
    initiativeRolls: {},
    mulliganDonePlayerIds: [],
    sideboardDonePlayerIds: [],
    soloSetupPending: false,
    players,
    log: [],
    chainEntries: [],
    chainResolveVotes: [],
    boardSettingsByPlayerId: Object.fromEntries(
      players.map((player) => [
        player.id,
        {
          showLegendXpCounter: false,
          stopAtBeginningPhase: false,
          skipDrawPhase: false,
          autoScoreFromHold: true,
        },
      ]),
    ),
  } as Room;
}

/* ------------------------------------------------------------------ helpers */

function playerOf(room: Room, playerId: string): RoomPlayer | undefined {
  return room.players.find((player) => player.id === playerId && !player.leftAt);
}

function boardOf(player: RoomPlayer): Board {
  if (!player.board) {
    player.board = emptyBoard(Date.now());
  }
  return player.board;
}

function zoneOf(board: Board, zone: Zone): CardInstance[] {
  const record = board as unknown as Record<string, unknown>;
  const value = record[zone];
  if (Array.isArray(value)) return value as CardInstance[];
  const created: CardInstance[] = [];
  record[zone] = created;
  return created;
}

function findCard(
  board: Board,
  zone: Zone,
  cardId: string,
): { cards: CardInstance[]; index: number; card: CardInstance } | null {
  const cards = zoneOf(board, zone);
  const index = cards.findIndex((card) => card.id === cardId);
  const card = cards[index];
  return card ? { cards, index, card } : null;
}

function logEntry(
  room: Room,
  ctx: EngineActionContext,
  text: string,
  extra: Partial<GameplayLogEntry> = {},
): GameplayLogEntry {
  const withCounter = room as RoomWithExtras;
  const counter = (withCounter.actionLogCounter ?? 0) + 1;
  withCounter.actionLogCounter = counter;
  return {
    id: `log_${ctx.now}_${counter}_${Math.floor(ctx.rng() * 1_000_000)}`,
    at: ctx.now,
    text,
    ...(room.activeTurnPlayerId ? { turnPlayerId: room.activeTurnPlayerId } : {}),
    ...(typeof room.turnNumber === "number" ? { turnNumber: room.turnNumber } : {}),
    ...extra,
  };
}

function pushLog(room: Room, entry: GameplayLogEntry): void {
  room.log.push(entry);
  if (room.log.length > 2_000) room.log.splice(0, room.log.length - 2_000);
}

function ok(
  room: Room,
  entries: GameplayLogEntry[],
  sound: string | null = null,
): EngineActionResult {
  room.updatedAt = entries.at(-1)?.at ?? room.updatedAt;
  return { ok: true, state: room, log: entries, sound };
}

function err(error: string, errorCode?: string): EngineActionResult {
  return { ok: false, error, ...(errorCode ? { errorCode } : {}) };
}

function activePlayers(room: Room): RoomPlayer[] {
  return room.players.filter((player) => !player.leftAt).sort((a, b) => a.seat - b.seat);
}

function nextPlayer(room: Room, currentId: string): RoomPlayer | null {
  const players = activePlayers(room);
  if (players.length === 0) return null;
  const index = players.findIndex((player) => player.id === currentId);
  if (index < 0) return players[0] ?? null;
  return players[(index + 1) % players.length] ?? null;
}

function victoryScoreFor(room: Room): number {
  return VICTORY_SCORE[room.gameVariant ?? "duel"] ?? 8;
}

function settleOutcome(
  room: Room,
  ctx: EngineActionContext,
  winnerId?: string,
): GameplayLogEntry[] {
  if (room.gameOutcome) return [];
  const players = activePlayers(room);
  const threshold = victoryScoreFor(room);
  const scores = players.map((player) => ({
    id: player.id,
    score: player.board?.score ?? 0,
  }));
  const candidate = winnerId
    ? scores.find((entry) => entry.id === winnerId)
    : [...scores].sort((a, b) => b.score - a.score)[0];
  if (!candidate || candidate.score < threshold) return [];
  const strictlyAhead = scores.every(
    (entry) => entry.id === candidate.id || candidate.score > entry.score,
  );
  if (!strictlyAhead) return [];
  room.gameOutcome = {
    winnerPlayerIds: [candidate.id],
    reason: "score",
    decidedAtTurnNumber: room.turnNumber ?? 1,
  };
  const winner = playerOf(room, candidate.id);
  const entry = logEntry(room, ctx, `${winner?.name ?? "A player"} won the game.`, {
    actionKind: "score",
  });
  pushLog(room, entry);
  return [entry];
}

function readyZones(board: Board): void {
  for (const zone of [
    "legend",
    "runeArea",
    "base",
    "battlefieldA",
    "battlefieldB",
    "battlefieldC",
    "battlefieldToken",
  ] as const) {
    for (const card of zoneOf(board, zone)) card.exhausted = false;
  }
}

function channelRunes(room: Room, player: RoomPlayer, count: number): number {
  const board = boardOf(player);
  const runes = zoneOf(board, "runeDeck");
  let channeled = 0;
  for (let index = 0; index < count; index += 1) {
    const rune = runes.shift();
    if (!rune) break;
    rune.exhausted = false;
    zoneOf(board, "runeArea").push(rune);
    channeled += 1;
  }
  return channeled;
}

function drawCards(room: Room, player: RoomPlayer, count: number): number {
  const board = boardOf(player);
  const deck = zoneOf(board, "deck");
  const hand = zoneOf(board, "hand");
  let drawn = 0;
  for (let index = 0; index < count; index += 1) {
    const card = deck.shift();
    if (!card) break;
    hand.push(card);
    drawn += 1;
  }
  return drawn;
}

function runBeginningPhase(room: Room, ctx: EngineActionContext): GameplayLogEntry[] {
  const entries: GameplayLogEntry[] = [];
  const activeId = room.activeTurnPlayerId;
  const player = activeId ? playerOf(room, activeId) : undefined;
  if (!player) return entries;
  const board = boardOf(player);
  const settings = room.boardSettingsByPlayerId?.[player.id];

  if (settings?.autoScoreFromHold !== false && !room.gameOutcome) {
    const scored = (room.battlefieldScoredThisTurnByPlayer ??= {});
    const playerScored = (scored[player.id] ??= {
      battlefieldA: false,
      battlefieldB: false,
      battlefieldC: false,
      battlefieldToken: false,
      turnNumber: room.turnNumber,
    });
    playerScored.turnNumber = room.turnNumber;
    for (const zone of [
      "battlefieldA",
      "battlefieldB",
      "battlefieldC",
      "battlefieldToken",
    ] as const) {
      if (zoneOf(board, zone).length === 0) continue;
      if (playerScored[zone] && playerScored.turnNumber === room.turnNumber) continue;
      playerScored[zone] = true;
      board.score = Math.min(99, board.score + 1);
      const entry = logEntry(room, ctx, `${player.name} scored 1 at ${zone}.`, {
        authorPlayerId: player.id,
        actionKind: "score",
      });
      pushLog(room, entry);
      entries.push(entry);
    }
    entries.push(...settleOutcome(room, ctx));
  }

  const channeled = channelRunes(room, player, 2);
  if (channeled > 0) {
    const entry = logEntry(
      room,
      ctx,
      `${player.name} channeled ${channeled} rune${channeled === 1 ? "" : "s"}.`,
      {
        authorPlayerId: player.id,
        actionKind: "resource",
      },
    );
    pushLog(room, entry);
    entries.push(entry);
  }
  if (!settings?.skipDrawPhase) {
    const drawn = drawCards(room, player, 1);
    if (drawn > 0) {
      const entry = logEntry(room, ctx, `${player.name} drew a card.`, {
        authorPlayerId: player.id,
        actionKind: "draw",
      });
      pushLog(room, entry);
      entries.push(entry);
    }
  }
  room.activeTurnStep = "main";
  return entries;
}

function beginTurn(room: Room, player: RoomPlayer, ctx: EngineActionContext): GameplayLogEntry[] {
  const entries: GameplayLogEntry[] = [];
  const board = boardOf(player);
  readyZones(board);
  room.activeTurnPlayerId = player.id;
  room.activeTurnStep = "beginning";
  room.turnNumber = (room.turnNumber ?? 0) + 1;
  room.playerTurnCounts = room.playerTurnCounts ?? {};
  room.playerTurnCounts[player.id] = (room.playerTurnCounts[player.id] ?? 0) + 1;
  room.pendingBattlefieldConquerAssist = undefined;
  const settings = room.boardSettingsByPlayerId?.[player.id];
  if (settings?.stopAtBeginningPhase) return entries;
  entries.push(...runBeginningPhase(room, ctx));
  return entries;
}

function dealOpeningHands(room: Room): void {
  for (const player of activePlayers(room)) {
    drawCards(room, player, 4);
  }
}

function startGame(
  room: Room,
  ctx: EngineActionContext,
  firstPlayerId: string,
): GameplayLogEntry[] {
  const entries: GameplayLogEntry[] = [];
  const first = playerOf(room, firstPlayerId) ?? activePlayers(room)[0];
  if (!first) return entries;
  room.phase = "in_game";
  room.firstPlayerId = first.id;
  room.turnNumber = 0;
  entries.push(...beginTurn(room, first, ctx));
  const entry = logEntry(room, ctx, "All mulligans are complete. The game has begun.", {
    actionKind: "turn",
  });
  pushLog(room, entry);
  entries.push(entry);
  return entries;
}

function autoCompleteSetup(room: Room, ctx: EngineActionContext): GameplayLogEntry[] {
  const entries: GameplayLogEntry[] = [];
  if (room.phase === "battlefield_pick") {
    for (const player of activePlayers(room)) {
      const extras = player as unknown as {
        battlefieldOptions?: Array<{ name: string; cardCode?: string }>;
      };
      const options = extras.battlefieldOptions ?? [];
      const picked = options[0];
      player.selectedBattlefield = picked?.name ?? "Training Grounds";
      if (picked?.cardCode) player.selectedBattlefieldCardCode = picked.cardCode;
    }
    room.phase = "initiative_roll";
    room.initiativeRound = 1;
    room.initiativeRolls = {};
  }
  if (room.phase === "initiative_roll") {
    const players = activePlayers(room);
    let winner: RoomPlayer | undefined;
    let round = room.initiativeRound ?? 1;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const rolls: Record<string, number> = {};
      for (const player of players) rolls[player.id] = Math.floor(ctx.rng() * 20) + 1;
      room.initiativeRolls = rolls;
      const values = Object.entries(rolls).sort((a, b) => b[1] - a[1]);
      if (values.length > 0 && (values.length === 1 || values[0]![1] > values[1]![1])) {
        winner = playerOf(room, values[0]![0]);
        break;
      }
      round += 1;
    }
    room.initiativeRound = round;
    room.firstPlayerChooserId = winner?.id ?? players[0]?.id;
    room.phase = "first_player_choice";
    if (room.firstPlayerChooserId) {
      const chosen = room.roomMode === "multiplayer" ? room.firstPlayerChooserId : players[0]?.id;
      room.firstPlayerId = chosen;
      room.phase = "mulligan";
      room.mulliganDonePlayerIds = [];
      dealOpeningHands(room);
    }
  }
  if (room.phase === "mulligan") {
    room.mulliganDonePlayerIds = activePlayers(room).map((player) => player.id);
    const first = room.firstPlayerId ?? activePlayers(room)[0]?.id;
    if (first) entries.push(...startGame(room, ctx, first));
  }
  return entries;
}

/* ------------------------------------------------------------------ actions */

export function applyFallbackAction(
  state: Room,
  actorPlayerId: string,
  actionValue: unknown,
  ctx: EngineActionContext,
): EngineActionResult {
  if (!isRecord(actionValue) || typeof actionValue.type !== "string") {
    return err("The gameplay action payload is malformed.", "invalid_action");
  }
  const action = actionValue as ActionRecord;
  // The development engine has no strict rules layer (@rift/rules runs inside @rift/engine).
  if (action.type === "set_lobby_rules_mode" || action.type.startsWith("rules_")) {
    return err("Strict rules need the full @rift/engine.", "strict_rules_unavailable");
  }
  const room = clone(state);
  const actor = playerOf(room, actorPlayerId);
  if (!actor)
    return err("This player is no longer registered in the room.", "player_not_registered");
  const board = boardOf(actor);
  const entries: GameplayLogEntry[] = [];
  const push = (entry: GameplayLogEntry) => {
    pushLog(room, entry);
    entries.push(entry);
  };
  const done = (sound: string | null = null) => ok(room, entries, sound);

  switch (action.type) {
    case "select_battlefield": {
      if (room.phase !== "battlefield_pick")
        return err("Battlefields cannot be selected right now.");
      if (actor.selectedBattlefield) return err("Your battlefield is already locked.");
      const extras = actor as unknown as {
        battlefieldOptions?: Array<{ name: string; cardCode?: string }>;
      };
      const options = extras.battlefieldOptions ?? [];
      const used = new Set(
        activePlayers(room)
          .filter((player) => player.id !== actor.id)
          .map((player) => player.selectedBattlefield),
      );
      const available = options.filter((option) => !used.has(option.name));
      const requested =
        typeof action.battlefield === "string" && action.battlefield.trim()
          ? available.find((option) => option.name === action.battlefield)
          : undefined;
      const picked = requested ?? available[0];
      if (!picked) return err("There are no battlefields left to choose.");
      actor.selectedBattlefield = picked.name;
      if (picked.cardCode) actor.selectedBattlefieldCardCode = picked.cardCode;
      push(
        logEntry(room, ctx, `${actor.name} selected ${picked.name} as their battlefield.`, {
          authorPlayerId: actor.id,
          actionKind: "board",
        }),
      );
      const active = activePlayers(room);
      if (active.every((player) => !!player.selectedBattlefield)) {
        room.phase = "initiative_roll";
        room.initiativeRound = 1;
        room.initiativeRolls = {};
        push(
          logEntry(
            room,
            ctx,
            `all ${active.length} battlefields are locked. All players may mulligan up to 2 cards.`,
            { actionKind: "board" },
          ),
        );
      }
      return done();
    }
    case "auto_start_test_setup": {
      entries.push(...autoCompleteSetup(room, ctx));
      return done();
    }
    case "roll_initiative": {
      if (room.phase !== "initiative_roll") return err("Initiative cannot be rolled right now.");
      room.initiativeRolls = room.initiativeRolls ?? {};
      if (room.initiativeRolls[actor.id] !== undefined)
        return err("You already rolled initiative.");
      room.initiativeRolls[actor.id] = Math.floor(ctx.rng() * 20) + 1;
      push(
        logEntry(
          room,
          ctx,
          `${actor.name} rolled ${room.initiativeRolls[actor.id]} for initiative.`,
          {
            authorPlayerId: actor.id,
            actionKind: "board",
          },
        ),
      );
      const active = activePlayers(room);
      if (active.every((player) => room.initiativeRolls?.[player.id] !== undefined)) {
        let round = room.initiativeRound ?? 1;
        let best: Array<[string, number]> = Object.entries(room.initiativeRolls).sort(
          (a, b) => b[1] - a[1],
        );
        let attempts = 0;
        while (best.length > 1 && best[0]![1] === best[1]![1] && attempts < 20) {
          attempts += 1;
          round += 1;
          const rolls: Record<string, number> = {};
          for (const player of active) rolls[player.id] = Math.floor(ctx.rng() * 20) + 1;
          room.initiativeRolls = rolls;
          best = Object.entries(rolls).sort((a, b) => b[1] - a[1]);
        }
        room.initiativeRound = round;
        const winnerId = best[0]?.[0];
        room.firstPlayerChooserId = winnerId;
        room.phase = "first_player_choice";
        const winner = winnerId ? playerOf(room, winnerId) : undefined;
        push(
          logEntry(
            room,
            ctx,
            `${winner?.name ?? "A player"} wins initiative (${best[0]?.[1]} vs ${best.at(-1)?.[1]}) and decides who plays first.`,
            { actionKind: "board" },
          ),
        );
      }
      return done();
    }
    case "choose_first_player": {
      if (room.phase !== "first_player_choice")
        return err("The first player cannot be chosen right now.");
      if (room.firstPlayerChooserId && actor.id !== room.firstPlayerChooserId) {
        return err("Only the initiative winner may choose the first player.");
      }
      const chosenId = typeof action.firstPlayerId === "string" ? action.firstPlayerId : "";
      if (!playerOf(room, chosenId)) return err("Choose a player in this match.");
      room.firstPlayerId = chosenId;
      room.phase = "mulligan";
      room.mulliganDonePlayerIds = [];
      dealOpeningHands(room);
      push(
        logEntry(
          room,
          ctx,
          `${actor.name} chose ${playerOf(room, chosenId)?.name ?? "a player"} to take the first turn.`,
          {
            authorPlayerId: actor.id,
            actionKind: "turn",
          },
        ),
      );
      return done();
    }
    case "choose_single_player_turn_order": {
      if (room.phase !== "first_player_choice")
        return err("The turn order cannot be chosen right now.");
      const order = action.turnOrder === "play_second" ? "play_second" : "play_first";
      room.singlePlayerTurnOrder = order;
      const active = activePlayers(room);
      const chosen = order === "play_first" ? active[0] : active.at(-1);
      if (!chosen) return err("There is no player to start the game.");
      room.firstPlayerId = chosen.id;
      room.phase = "mulligan";
      room.mulliganDonePlayerIds = [];
      dealOpeningHands(room);
      push(
        logEntry(
          room,
          ctx,
          `${actor.name} chose to ${order === "play_first" ? "play first" : "play second"}.`,
          {
            authorPlayerId: actor.id,
            actionKind: "turn",
          },
        ),
      );
      return done();
    }
    case "submit_mulligan": {
      if (room.phase !== "mulligan") return err("Mulligans cannot be submitted right now.");
      room.mulliganDonePlayerIds = room.mulliganDonePlayerIds ?? [];
      if (room.mulliganDonePlayerIds.includes(actor.id))
        return err("You already submitted a mulligan.");
      const cardIds = Array.isArray(action.cardIds)
        ? action.cardIds.filter((value): value is string => typeof value === "string")
        : [];
      if (cardIds.length > 2) return err("You may mulligan at most 2 cards.");
      const hand = zoneOf(board, "hand");
      const selected: CardInstance[] = [];
      for (const cardId of cardIds) {
        const index = hand.findIndex((card) => card.id === cardId);
        if (index < 0) return err("That card is not in your hand.");
        const [card] = hand.splice(index, 1);
        if (card) selected.push(card);
      }
      const deck = zoneOf(board, "deck");
      deck.push(...selected);
      drawCards(room, actor, selected.length);
      room.mulliganDonePlayerIds.push(actor.id);
      push(
        logEntry(
          room,
          ctx,
          `${actor.name} mulliganed ${selected.length} card${selected.length === 1 ? "" : "s"}.`,
          {
            authorPlayerId: actor.id,
            actionKind: "draw",
          },
        ),
      );
      if (room.roomMode !== "multiplayer") {
        for (const player of activePlayers(room)) {
          if (!room.mulliganDonePlayerIds.includes(player.id)) {
            drawCards(room, player, 0);
            room.mulliganDonePlayerIds.push(player.id);
          }
        }
      }
      const active = activePlayers(room);
      if (active.every((player) => room.mulliganDonePlayerIds?.includes(player.id))) {
        const first = room.firstPlayerId ?? active[0]?.id;
        if (first) entries.push(...startGame(room, ctx, first));
      }
      return done();
    }
    case "submit_sideboard": {
      if (room.phase !== "sideboarding") return err("Sideboards cannot be submitted right now.");
      room.sideboardDonePlayerIds = room.sideboardDonePlayerIds ?? [];
      if (!room.sideboardDonePlayerIds.includes(actor.id))
        room.sideboardDonePlayerIds.push(actor.id);
      push(
        logEntry(room, ctx, `${actor.name} submitted their sideboard.`, {
          authorPlayerId: actor.id,
          actionKind: "board",
        }),
      );
      if (activePlayers(room).every((player) => room.sideboardDonePlayerIds?.includes(player.id))) {
        room.phase = "battlefield_pick";
      }
      return done();
    }
    case "confirm_solo_setup": {
      room.soloSetupPending = false;
      if (room.phase === "lobby" || room.phase === "sideboarding") room.phase = "battlefield_pick";
      return done();
    }
    case "end_beginning_phase": {
      if (room.phase !== "in_game" || room.activeTurnStep !== "beginning") {
        return err("The beginning phase is not active.");
      }
      entries.push(...runBeginningPhase(room, ctx));
      return done();
    }
    case "end_turn": {
      if (room.phase !== "in_game") return err("The game has not started.");
      if (room.activeTurnPlayerId !== actor.id) return err("It is not your turn.");
      if (room.activeTurnStep === "beginning") entries.push(...runBeginningPhase(room, ctx));
      for (const player of activePlayers(room)) {
        const playerBoard = boardOf(player);
        playerBoard.floatingEnergy = 0;
        playerBoard.floatingPower = 0;
      }
      push(
        logEntry(room, ctx, `${actor.name} ended their turn.`, {
          authorPlayerId: actor.id,
          actionKind: "turn",
        }),
      );
      const outcome = settleOutcome(room, ctx);
      entries.push(...outcome);
      const next = nextPlayer(room, actor.id);
      if (next) entries.push(...beginTurn(room, next, ctx));
      return done();
    }
    case "draw_cards": {
      const count =
        typeof action.count === "number" && Number.isFinite(action.count)
          ? Math.max(0, Math.min(20, Math.trunc(action.count)))
          : 1;
      const to = typeof action.to === "string" ? (action.to as Zone) : "hand";
      const deck = zoneOf(board, "deck");
      const target = zoneOf(board, to);
      let drawn = 0;
      for (let index = 0; index < count; index += 1) {
        const card = deck.shift();
        if (!card) break;
        target.push(card);
        drawn += 1;
      }
      if (drawn > 0) {
        push(
          logEntry(room, ctx, `${actor.name} drew ${drawn} card${drawn === 1 ? "" : "s"}.`, {
            authorPlayerId: actor.id,
            actionKind: "draw",
          }),
        );
      }
      return done();
    }
    case "draw_rune":
    case "channel_rune_deck": {
      const exhausted = action.exhausted === true;
      const runes = zoneOf(board, "runeDeck");
      const rune = runes.shift();
      if (!rune) return err("The rune deck is empty.", "rune_deck_empty");
      rune.exhausted = exhausted;
      zoneOf(board, "runeArea").push(rune);
      push(
        logEntry(room, ctx, `${actor.name} channeled a rune.`, {
          authorPlayerId: actor.id,
          actionKind: "resource",
        }),
      );
      return done();
    }
    case "toggle_exhausted": {
      const zone = action.zone;
      const cardId = action.cardId;
      if (typeof zone !== "string" || !ZONES.includes(zone as Zone) || typeof cardId !== "string") {
        return err("The gameplay action payload is malformed.", "invalid_action");
      }
      const found = findCard(board, zone as Zone, cardId);
      if (!found) return err("That card is no longer in that zone.");
      if (
        typeof action.expectedExhausted === "boolean" &&
        found.card.exhausted !== action.expectedExhausted
      ) {
        return err("The card changed before this action could complete. Please try again.");
      }
      found.card.exhausted = !found.card.exhausted;
      return done();
    }
    case "move_card": {
      const from = action.from;
      const to = action.to;
      const cardId = action.cardId;
      if (
        typeof from !== "string" ||
        typeof to !== "string" ||
        !ZONES.includes(from as Zone) ||
        !ZONES.includes(to as Zone) ||
        typeof cardId !== "string"
      ) {
        return err("The gameplay action payload is malformed.", "invalid_action");
      }
      const source = zoneOf(board, from as Zone);
      const index = source.findIndex((card) => card.id === cardId);
      const card = source[index];
      if (!card) return err("That card is no longer in that zone.");
      source.splice(index, 1);
      const destination = zoneOf(board, to as Zone);
      const requested =
        typeof action.toIndex === "number" && Number.isFinite(action.toIndex)
          ? Math.max(0, Math.min(destination.length, Math.trunc(action.toIndex)))
          : destination.length;
      if (action.asHidden === true) card.hidden = true;
      destination.splice(requested, 0, card);
      return done();
    }
    case "adjust_score":
    case "set_score": {
      const delta =
        action.type === "set_score"
          ? Math.trunc(Number(action.score) || 0) - board.score
          : Math.trunc(Number(action.delta) || 0);
      board.score = Math.max(0, Math.min(99, board.score + delta));
      push(
        logEntry(room, ctx, `${actor.name} adjusted score to ${board.score}.`, {
          authorPlayerId: actor.id,
          actionKind: "score",
        }),
      );
      entries.push(...settleOutcome(room, ctx));
      return done();
    }
    case "adjust_floating_resource": {
      const resource = action.resource === "power" ? "power" : "energy";
      const delta = Math.trunc(Number(action.delta) || 0);
      if (resource === "power") {
        board.floatingPower = Math.max(0, Math.min(99, board.floatingPower + delta));
      } else {
        board.floatingEnergy = Math.max(0, Math.min(99, board.floatingEnergy + delta));
      }
      return done();
    }
    case "clear_floating_resources": {
      board.floatingEnergy = 0;
      board.floatingPower = 0;
      return done();
    }
    case "adjust_legend_xp": {
      const delta = Math.trunc(Number(action.delta) || 0);
      board.legendXp = Math.max(0, Math.min(99, (board.legendXp ?? 0) + delta));
      push(
        logEntry(room, ctx, `${actor.name} adjusted legend XP to ${board.legendXp}.`, {
          authorPlayerId: actor.id,
          actionKind: "legend-xp",
        }),
      );
      return done();
    }
    case "adjust_card_might": {
      const found =
        typeof action.zone === "string" && typeof action.cardId === "string"
          ? findCard(board, action.zone as Zone, action.cardId)
          : null;
      if (!found) return err("That card is no longer in that zone.");
      const delta = Math.trunc(Number(action.delta) || 0);
      found.card.might = Math.max(0, Math.min(99, (found.card.might ?? 0) + delta));
      return done();
    }
    case "adjust_card_counter":
    case "clear_card_counter": {
      const found =
        typeof action.zone === "string" && typeof action.cardId === "string"
          ? findCard(board, action.zone as Zone, action.cardId)
          : null;
      if (!found) return err("That card is no longer in that zone.");
      const key = action.counter === "red" ? "redCounter" : "whiteCounter";
      if (action.type === "clear_card_counter") {
        delete found.card[key];
      } else {
        const delta = Math.trunc(Number(action.delta) || 0);
        const initial =
          key === "whiteCounter" && action.initializeAtUnitMight === true
            ? (found.card.might ?? 0)
            : (found.card[key] ?? 0);
        found.card[key] = Math.max(0, initial + delta);
      }
      return done();
    }
    case "set_card_label": {
      const found =
        typeof action.zone === "string" && typeof action.cardId === "string"
          ? findCard(board, action.zone as Zone, action.cardId)
          : null;
      if (!found) return err("That card is no longer in that zone.");
      const slot = Number(action.slot);
      if (!Number.isInteger(slot) || slot < 0 || slot > 2) return err("Invalid card label slot.");
      const labels = [...(found.card.customLabels ?? [])];
      const label = typeof action.label === "string" ? action.label.trim().slice(0, 512) : "";
      labels[slot] = label;
      found.card.customLabels = labels;
      return done();
    }
    case "create_token": {
      const zone =
        typeof action.zone === "string" && ZONES.includes(action.zone as Zone)
          ? (action.zone as Zone)
          : "base";
      const count = Math.max(1, Math.min(10, Math.trunc(Number(action.count) || 1)));
      const cards = zoneOf(board, zone);
      const name =
        typeof action.name === "string" && action.name.trim() ? action.name.trim() : "Token";
      for (let index = 0; index < count; index += 1) {
        cards.push({
          id: `token_${ctx.now}_${Math.floor(ctx.rng() * 1_000_000)}_${index}`,
          name,
          source: "token",
          exhausted: action.exhausted === true,
          createdAt: ctx.now,
          ownerPlayerId: actor.id,
          type: "Unit",
        });
      }
      push(
        logEntry(
          room,
          ctx,
          `${actor.name} created ${count} ${name} token${count === 1 ? "" : "s"}.`,
          {
            authorPlayerId: actor.id,
            actionKind: "board",
          },
        ),
      );
      return done();
    }
    case "duplicate_card": {
      const found =
        typeof action.zone === "string" && typeof action.cardId === "string"
          ? findCard(board, action.zone as Zone, action.cardId)
          : null;
      if (!found) return err("That card is no longer in that zone.");
      const target =
        playerOf(
          room,
          typeof action.targetPlayerId === "string" ? action.targetPlayerId : actor.id,
        ) ?? actor;
      const targetBoard = boardOf(target);
      const zone = action.zone as Zone;
      const source = found.card;
      const copyCard: CardInstance = {
        ...clone(source),
        id:
          typeof action.clientCardId === "string"
            ? action.clientCardId
            : `copy_${ctx.now}_${Math.floor(ctx.rng() * 1_000_000)}`,
        ownerPlayerId: target.id,
        isDuplicate: true,
        createdAt: ctx.now,
      };
      zoneOf(targetBoard, zone).push(copyCard);
      return done();
    }
    case "shuffle_deck": {
      const deck = zoneOf(board, "deck");
      for (let index = deck.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(ctx.rng() * (index + 1));
        const a = deck[index];
        const b = deck[swap];
        if (a && b) {
          deck[index] = b;
          deck[swap] = a;
        }
      }
      return done();
    }
    case "take_top_from_deck":
    case "take_card_from_deck": {
      const deck = zoneOf(board, "deck");
      let card: CardInstance | undefined;
      if (action.type === "take_top_from_deck") {
        card = deck.shift();
      } else if (typeof action.cardId === "string") {
        const index = deck.findIndex((candidate) => candidate.id === action.cardId);
        if (index >= 0) [card] = deck.splice(index, 1);
      }
      if (!card) return err("That card is no longer in the deck.");
      const to =
        typeof action.to === "string" && ZONES.includes(action.to as Zone)
          ? (action.to as Zone)
          : "hand";
      zoneOf(board, to).push(card);
      return done();
    }
    case "send_to_deck":
    case "send_to_rune_deck": {
      const from = action.type === "send_to_deck" ? action.from : "runeArea";
      if (
        typeof from !== "string" ||
        !ZONES.includes(from as Zone) ||
        typeof action.cardId !== "string"
      ) {
        return err("The gameplay action payload is malformed.", "invalid_action");
      }
      const found = findCard(board, from as Zone, action.cardId);
      if (!found) return err("That card is no longer in that zone.");
      found.cards.splice(found.index, 1);
      const deck = zoneOf(board, action.type === "send_to_deck" ? "deck" : "runeDeck");
      if (action.position === "bottom") deck.push(found.card);
      else deck.unshift(found.card);
      return done();
    }
    case "recycle_all_trash_to_deck": {
      const trash = zoneOf(board, "trash");
      const deck = zoneOf(board, "deck");
      deck.push(...trash.splice(0, trash.length));
      for (let index = deck.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(ctx.rng() * (index + 1));
        const a = deck[index];
        const b = deck[swap];
        if (a && b) {
          deck[index] = b;
          deck[swap] = a;
        }
      }
      return done();
    }
    case "set_show_legend_xp_counter":
    case "set_stop_at_beginning_phase":
    case "set_skip_draw_phase":
    case "set_auto_score_from_hold": {
      const settings = (room.boardSettingsByPlayerId ??= {});
      const current = (settings[actor.id] ??= {
        showLegendXpCounter: false,
        stopAtBeginningPhase: false,
        skipDrawPhase: false,
        autoScoreFromHold: true,
      });
      const value = action.visible === true || action.enabled === true;
      if (action.type === "set_show_legend_xp_counter") current.showLegendXpCounter = value;
      if (action.type === "set_stop_at_beginning_phase") current.stopAtBeginningPhase = value;
      if (action.type === "set_skip_draw_phase") current.skipDrawPhase = value;
      if (action.type === "set_auto_score_from_hold") current.autoScoreFromHold = value;
      return done();
    }
    case "set_hand_reveal": {
      const reveal = action.reveal === true;
      if (typeof action.targetPlayerId === "string") {
        const ids = new Set(board.handRevealedToPlayerIds ?? []);
        if (reveal) ids.add(action.targetPlayerId);
        else ids.delete(action.targetPlayerId);
        board.handRevealedToPlayerIds = [...ids];
      } else {
        board.handRevealToOpponent = reveal;
      }
      return done();
    }
    case "set_card_hidden": {
      const zone = typeof action.zone === "string" ? (action.zone as Zone) : "hand";
      const found = typeof action.cardId === "string" ? findCard(board, zone, action.cardId) : null;
      if (!found) return err("That card is no longer in that zone.");
      found.card.hidden = action.hidden === true;
      return done();
    }
    case "set_card_revealed_to_opponent": {
      const found =
        typeof action.zone === "string" && typeof action.cardId === "string"
          ? findCard(board, action.zone as Zone, action.cardId)
          : null;
      if (!found) return err("That card is no longer in that zone.");
      if (typeof action.targetPlayerId === "string") {
        const ids = new Set(found.card.revealedToPlayerIds ?? []);
        if (action.revealed === true) ids.add(action.targetPlayerId);
        else ids.delete(action.targetPlayerId);
        found.card.revealedToPlayerIds = [...ids];
      } else {
        found.card.revealedToOpponent = action.revealed === true;
      }
      return done();
    }
    case "peek_deck_top":
    case "peek_deck_bottom": {
      const zone = action.zone === "runeDeck" ? "runeDeck" : "deck";
      const count = Math.max(1, Math.min(10, Math.trunc(Number(action.count) || 1)));
      const cards = zoneOf(board, zone);
      const selected =
        action.type === "peek_deck_top"
          ? cards.slice(0, count)
          : cards.slice(Math.max(0, cards.length - count));
      board.deckPeek = {
        cardIds: selected.map((card) => card.id),
        revealedCardIds: selected.map((card) => card.id),
        ...(zone === "runeDeck" ? { zone: "runeDeck" as const } : {}),
      };
      return done();
    }
    case "clear_deck_peek":
    case "dismiss_deck_peek": {
      board.deckPeek = { cardIds: [], revealedCardIds: [] };
      return done();
    }
    case "set_deck_peek_card_reveal":
    case "set_deck_peek_cards_reveal": {
      const ids =
        action.type === "set_deck_peek_card_reveal" && typeof action.cardId === "string"
          ? [action.cardId]
          : Array.isArray(action.cardIds)
            ? action.cardIds.filter((value): value is string => typeof value === "string")
            : [];
      const peek = board.deckPeek ?? { cardIds: [], revealedCardIds: [] };
      const revealed = new Set(peek.revealedCardIds);
      for (const id of ids) {
        if (action.reveal === true) revealed.add(id);
        else revealed.delete(id);
      }
      peek.revealedCardIds = [...revealed];
      board.deckPeek = peek;
      return done();
    }
    case "recycle_deck_peek_card": {
      const cardId = typeof action.cardId === "string" ? action.cardId : "";
      const zone = action.zone === "runeDeck" ? "runeDeck" : "deck";
      const found = findCard(board, zone, cardId);
      if (!found) return err("That card is no longer in the deck.");
      found.cards.splice(found.index, 1);
      found.cards.push(found.card);
      board.deckPeek = { cardIds: [], revealedCardIds: [] };
      return done();
    }
    case "put_deck_peek_card_on_top": {
      const cardId = typeof action.cardId === "string" ? action.cardId : "";
      const zone = action.zone === "runeDeck" ? "runeDeck" : "deck";
      const found = findCard(board, zone, cardId);
      if (!found) return err("That card is no longer in the deck.");
      found.cards.splice(found.index, 1);
      found.cards.unshift(found.card);
      board.deckPeek = { cardIds: [], revealedCardIds: [] };
      return done();
    }
    case "chain_add": {
      if (room.chainEntries.length >= 20) return err("The Chain is full.");
      const from = typeof action.from === "string" ? action.from : "hand";
      const cardId = typeof action.cardId === "string" ? action.cardId : "";
      let card: CardInstance | undefined;
      if (from !== "battlefieldMarker" && ZONES.includes(from as Zone)) {
        const found = findCard(board, from as Zone, cardId);
        if (!found) return err("That card is no longer in that zone.");
        found.cards.splice(found.index, 1);
        card = found.card;
      }
      if (!card) return err("That card is no longer available.");
      const entry: ChainEntry = {
        id:
          typeof action.clientEntryId === "string" && action.clientEntryId.trim()
            ? action.clientEntryId
            : `chain_${room.turnNumber ?? 1}_${room.chainEntries.length + 1}`,
        card,
        addedAt: ctx.now,
        fromZone: from as Zone,
        byPlayerId: actor.id,
        byPlayerName: actor.name,
      };
      room.chainEntries.unshift(entry);
      push(
        logEntry(room, ctx, `${actor.name} added ${card.name} to the chain.`, {
          authorPlayerId: actor.id,
          actionKind: "spell",
        }),
      );
      return done();
    }
    case "chain_resolve": {
      const entryId = typeof action.entryId === "string" ? action.entryId : "";
      const index = room.chainEntries.findIndex((entry) => entry.id === entryId);
      const entry = room.chainEntries[index];
      if (!entry) return err("That chain entry is no longer available.");
      room.chainEntries.splice(index, 1);
      room.chainResolveVotes = [];
      const requested = typeof action.to === "string" ? action.to : null;
      const zone: Zone =
        requested && ZONES.includes(requested as Zone)
          ? (requested as Zone)
          : entry.flowEnabled
            ? "banished"
            : "trash";
      if (requested === "deck_top") zoneOf(board, "deck").unshift(entry.card);
      else if (requested === "deck_bottom") zoneOf(board, "deck").push(entry.card);
      else zoneOf(board, zone).push(entry.card);
      push(
        logEntry(room, ctx, `${actor.name} resolved ${entry.card.name} from the chain.`, {
          authorPlayerId: actor.id,
          actionKind: "spell",
        }),
      );
      return done();
    }
    case "chain_set_repeat":
    case "chain_set_flow": {
      const entryId = typeof action.entryId === "string" ? action.entryId : "";
      const entry = room.chainEntries.find((candidate) => candidate.id === entryId);
      if (!entry) return err("That chain entry is no longer available.");
      if (action.type === "chain_set_repeat") entry.repeatEnabled = action.enabled === true;
      else entry.flowEnabled = action.enabled === true;
      return done();
    }
    case "chain_set_resolve_vote": {
      const entryId = typeof action.entryId === "string" ? action.entryId : "";
      const entry = room.chainEntries.find((candidate) => candidate.id === entryId);
      if (!entry) return err("That chain entry is no longer available.");
      const votes = new Set(room.chainResolveVotes);
      if (action.approved === true) votes.add(actor.id);
      else votes.delete(actor.id);
      room.chainResolveVotes = [...votes];
      return done();
    }
    case "battlefield_conquer_confirm": {
      const zone = action.zone;
      if (typeof zone !== "string")
        return err("The gameplay action payload is malformed.", "invalid_action");
      room.pendingBattlefieldConquerAssist = undefined;
      const scored = (room.battlefieldScoredThisTurnByPlayer ??= {});
      const map = (scored[actor.id] ??= {
        battlefieldA: false,
        battlefieldB: false,
        battlefieldC: false,
        battlefieldToken: false,
        turnNumber: room.turnNumber,
      });
      board.score = Math.min(99, board.score + 1);
      push(
        logEntry(room, ctx, `${actor.name} conquered ${zone} and scored 1.`, {
          authorPlayerId: actor.id,
          actionKind: "score",
        }),
      );
      entries.push(...settleOutcome(room, ctx));
      return done();
    }
    case "battlefield_conquer_dismiss": {
      room.pendingBattlefieldConquerAssist = undefined;
      return done();
    }
    case "battlefield_conquer_pass_focus":
    case "battlefield_conquer_pass_response":
    case "battlefield_conquer_set_optional_pass": {
      return done();
    }
    case "target_arrow_add": {
      const sourceCardId = typeof action.sourceCardId === "string" ? action.sourceCardId : "";
      const targetCardId = typeof action.targetCardId === "string" ? action.targetCardId : "";
      if (!sourceCardId || !targetCardId)
        return err("The gameplay action payload is malformed.", "invalid_action");
      const arrows = (room.targetArrowsByPlayer ??= {});
      const list = (arrows[actor.id] ??= []);
      if (
        !list.some(
          (arrow) => arrow.sourceCardId === sourceCardId && arrow.targetCardId === targetCardId,
        )
      ) {
        list.push({
          sourceCardId,
          targetCardId,
          sourceAnchor: action.sourceAnchor === "chain" ? "chain" : "board",
          targetAnchor: action.targetAnchor === "chain" ? "chain" : "board",
        });
        if (list.length > 20) list.shift();
      }
      return done();
    }
    case "target_arrow_remove": {
      const sourceCardId = typeof action.sourceCardId === "string" ? action.sourceCardId : "";
      const targetCardId = typeof action.targetCardId === "string" ? action.targetCardId : "";
      const list = room.targetArrowsByPlayer?.[actor.id] ?? [];
      room.targetArrowsByPlayer = {
        ...room.targetArrowsByPlayer,
        [actor.id]: list.filter(
          (arrow) => arrow.sourceCardId !== sourceCardId || arrow.targetCardId !== targetCardId,
        ),
      };
      return done();
    }
    case "target_arrow_remove_from_source": {
      const sourceCardId = typeof action.sourceCardId === "string" ? action.sourceCardId : "";
      const list = room.targetArrowsByPlayer?.[actor.id] ?? [];
      room.targetArrowsByPlayer = {
        ...room.targetArrowsByPlayer,
        [actor.id]: list.filter((arrow) => arrow.sourceCardId !== sourceCardId),
      };
      return done();
    }
    case "target_arrow_clear_all": {
      room.targetArrowsByPlayer = { ...room.targetArrowsByPlayer, [actor.id]: [] };
      return done();
    }
    case "roll_die": {
      const sides = Number(action.sides);
      if (![4, 6, 8, 10, 12, 20].includes(sides)) return err("Choose a supported die type.");
      const result = Math.floor(ctx.rng() * sides) + 1;
      const roll = {
        id: `roll_${ctx.now}_${Math.floor(ctx.rng() * 1_000_000)}`,
        playerId: actor.id,
        sides: sides as 4 | 6 | 8 | 10 | 12 | 20,
        result,
        rolledAt: ctx.now,
      };
      room.lastDieRoll = roll;
      room.recentDieRolls = [
        ...(room.recentDieRolls ?? []).filter((item) => ctx.now - item.rolledAt < 5_000),
        roll,
      ].slice(-16);
      push(
        logEntry(room, ctx, `${actor.name} rolled a d${sides}: ${result}.`, {
          authorPlayerId: actor.id,
          actionKind: "board",
        }),
      );
      return done();
    }
    case "set_battlefield_brush": {
      const zone = action.zone;
      if (typeof zone !== "string")
        return err("The gameplay action payload is malformed.", "invalid_action");
      const map = (room.battlefieldBrushByZone ??= {});
      if (action.active === true) map[zone as keyof typeof map] = true;
      else delete map[zone as keyof typeof map];
      return done();
    }
    case "set_extra_turn": {
      const entryId = typeof action.entryId === "string" ? action.entryId : "";
      const list = (room.pendingExtraTurns ?? []).filter((item) => item.sourceEntryId !== entryId);
      if (action.enabled === true) list.push({ sourceEntryId: entryId, playerId: actor.id });
      room.pendingExtraTurns = list;
      return done();
    }
    case "transfer_card_control": {
      const zone = action.zone;
      const cardId = action.cardId;
      if (typeof zone !== "string" || typeof cardId !== "string")
        return err("The gameplay action payload is malformed.", "invalid_action");
      const target =
        typeof action.targetPlayerId === "string"
          ? playerOf(room, action.targetPlayerId)
          : undefined;
      if (!target || target.id === actor.id) return err("Choose a valid player.");
      const found = findCard(board, zone as Zone, cardId);
      if (!found) return err("That card is no longer in that zone.");
      found.cards.splice(found.index, 1);
      found.card.ownerPlayerId = target.id;
      zoneOf(boardOf(target), zone as Zone).push(found.card);
      return done();
    }
    case "equip_card": {
      const equipmentCardId = action.equipmentCardId;
      const unitCardId = action.unitCardId;
      if (typeof equipmentCardId !== "string" || typeof unitCardId !== "string") {
        return err("The gameplay action payload is malformed.", "invalid_action");
      }
      const zones: Zone[] = [
        "hand",
        "base",
        "battlefieldA",
        "battlefieldB",
        "battlefieldC",
        "battlefieldToken",
      ];
      for (const zone of zones) {
        const found = findCard(board, zone, equipmentCardId);
        if (found) {
          found.card.attachedToCardId = unitCardId;
          return done();
        }
      }
      return err("That card is no longer in that zone.");
    }
    case "unlink_banished_card": {
      const zone = action.zone;
      const cardId = action.cardId;
      const targetCardId = action.targetCardId;
      if (
        typeof zone !== "string" ||
        typeof cardId !== "string" ||
        typeof targetCardId !== "string"
      ) {
        return err("The gameplay action payload is malformed.", "invalid_action");
      }
      const link = findCard(board, zone as Zone, cardId);
      const target = findCard(board, zone as Zone, targetCardId);
      if (link?.card.banishedByCardId === targetCardId) delete link.card.banishedByCardId;
      if (target?.card.banishedByCardId === cardId) delete target.card.banishedByCardId;
      return done();
    }
    case "payment_batch":
    case "rune_batch":
    case "floating_resource_batch": {
      const operations = Array.isArray(action.operations) ? action.operations : [];
      if (operations.length === 0) return done();
      for (const raw of operations) {
        if (!isRecord(raw) || typeof raw.type !== "string") return err("Invalid batch operation.");
        switch (raw.type) {
          case "toggle_exhausted": {
            if (typeof raw.zone !== "string" || typeof raw.cardId !== "string")
              return err("Invalid batch operation.");
            const found = findCard(board, raw.zone as Zone, raw.cardId);
            if (!found) return err("That card is no longer in that zone.");
            found.card.exhausted = raw.expectedExhausted === true ? false : true;
            break;
          }
          case "adjust_floating_resource": {
            const resource = raw.resource === "power" ? "power" : "energy";
            const delta = Math.trunc(Number(raw.delta) || 0);
            if (resource === "power")
              board.floatingPower = Math.max(0, board.floatingPower + delta);
            else board.floatingEnergy = Math.max(0, board.floatingEnergy + delta);
            break;
          }
          case "draw_rune": {
            const runes = zoneOf(board, "runeDeck");
            const rune = runes.shift();
            if (rune) {
              rune.exhausted = raw.exhausted === true;
              zoneOf(board, "runeArea").push(rune);
            }
            break;
          }
          case "set_rune_exhausted": {
            if (typeof raw.cardId !== "string") return err("Invalid batch operation.");
            const found = findCard(board, "runeArea", raw.cardId);
            if (found) found.card.exhausted = raw.exhausted === true;
            break;
          }
          case "send_rune_to_deck_bottom": {
            if (typeof raw.cardId !== "string") return err("Invalid batch operation.");
            const found = findCard(board, "runeArea", raw.cardId);
            if (found) {
              found.cards.splice(found.index, 1);
              zoneOf(board, "deck").push(found.card);
            }
            break;
          }
          case "recycle_rune_for_floating_energy": {
            if (typeof raw.cardId !== "string") return err("Invalid batch operation.");
            const found = findCard(board, "runeArea", raw.cardId);
            if (found) {
              found.cards.splice(found.index, 1);
              zoneOf(board, "deck").push(found.card);
              board.floatingEnergy = Math.min(99, board.floatingEnergy + 1);
            }
            break;
          }
          case "clear_floating_resources": {
            board.floatingEnergy = 0;
            board.floatingPower = 0;
            break;
          }
          case "set_card_label": {
            if (typeof raw.cardId !== "string" || typeof raw.zone !== "string")
              return err("Invalid batch operation.");
            const found = findCard(board, raw.zone as Zone, raw.cardId);
            if (!found) return err("That card is no longer in that zone.");
            const slot = Number(raw.slot);
            if (!Number.isInteger(slot) || slot < 0 || slot > 2)
              return err("Invalid card label slot.");
            const labels = [...(found.card.customLabels ?? [])];
            labels[slot] = typeof raw.label === "string" ? raw.label.slice(0, 512) : "";
            found.card.customLabels = labels;
            break;
          }
          default:
            return err("Invalid batch operation.");
        }
      }
      return done();
    }
    default:
      return err("That action is not supported yet.", "unsupported_action");
  }
}

/** Convenience for the solo/test setup path. */
export function autoStartFallbackSetup(state: Room, ctx: EngineActionContext): Room {
  const room = clone(state);
  autoCompleteSetup(room, ctx);
  return room;
}
