/**
 * The @rift/engine implementation of `RulesHost`.
 *
 * Everything here delegates to the existing engine helpers so zone movement, token creation,
 * shuffling and scoring have exactly one implementation (sandbox parity is sacred).
 */
import type {
  BattlefieldZone,
  CardInstance,
  GameplayLogEntry,
  PlayerBoard,
  Room,
} from "@rift/protocol";
import type { CardInfo, LocatedCard, RulesContext, RulesHost, RulesLogEntry } from "@rift/rules";
import {
  allCardIds,
  cloneCard,
  findCardAnywhere,
  insertAfterAttachments,
  isTokenOrDuplicate,
  moveCardCleanup,
  readZoneList,
  shuffleIds,
  takeCardId,
  zoneList,
} from "../state/board";
import { makeIdFactory, makeLogId } from "../state/ids";
import { markBattlefieldScored, entityScore, setEntityScore } from "../state/selectors";
import { turnOrderForRoom } from "../state/variant";
import { battlefieldZones, battlefieldCount } from "../state/selectors";
import { moveCard as engineMoveCard, transferCardControl } from "../rules/movement";
import { settleRoom, victoryScoreForRoom } from "../rules/victory";
import { nextTurnPlayer } from "../rules/turn";
import {
  cardForInstance,
  getCard,
  isUnitCardType,
  tokenDefaultsExhausted,
  tokenImage,
  tokenMightByName,
  tokenType,
} from "../catalog";

const READY_ZONES = [
  "legend",
  "runeArea",
  "base",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
] as const;

const CARD_ZONES = [
  "hand",
  "base",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
  "trash",
  "banished",
  "champion",
  "legend",
  "runeArea",
  "deck",
  "runeDeck",
] as const;

function boardOf(room: Room, playerId: string): PlayerBoard | null {
  return room.players.find((player) => player.id === playerId)?.board ?? null;
}

function playerIndexOf(room: Room, playerId: string): number {
  return room.players.findIndex((player) => player.id === playerId);
}

function findCardEverywhere(room: Room, cardId: string): LocatedCard | null {
  for (const player of room.players) {
    const board = player.board;
    if (!board) continue;
    const located = findCardAnywhere(board, cardId);
    if (located) {
      return { playerId: player.id, zone: located.zone, index: located.index, card: located.card };
    }
    for (const zone of ["deck", "runeDeck"] as const) {
      const list = readZoneList(board, zone);
      const index = list.findIndex((card) => card.id === cardId);
      const card = index >= 0 ? list[index] : undefined;
      if (card) return { playerId: player.id, zone, index, card };
    }
  }
  return null;
}

/** Generic take+put between any two lists, preserving the card object. */
function moveBetweenZones(
  room: Room,
  playerId: string,
  from: string,
  to: string,
  cardId: string,
  position: "top" | "bottom" | number = "bottom",
): boolean {
  const board = boardOf(room, playerId);
  if (!board) return false;
  if (
    !(CARD_ZONES as readonly string[]).includes(from) ||
    !(CARD_ZONES as readonly string[]).includes(to)
  ) {
    return false;
  }
  const source = zoneList(board, from);
  const index = source.findIndex((card) => card.id === cardId);
  const card = index >= 0 ? source[index] : undefined;
  if (!card) return false;
  source.splice(index, 1);
  const destination = zoneList(board, to);
  const at = destinationIndex(to, destination.length, position);
  destination.splice(at, 0, card);
  return true;
}

function destinationIndex(
  zone: string,
  length: number,
  position: "top" | "bottom" | number,
): number {
  if (typeof position === "number") {
    return Math.max(0, Math.min(Math.trunc(position), length));
  }
  const deckLike = zone === "deck" || zone === "runeDeck";
  // Main/rune decks draw from the end of the array (the "top").
  if (position === "top") return deckLike ? length : 0;
  return deckLike ? 0 : length;
}

/** Replace a card in its zone list with an updated clone. */
function updateCard(room: Room, cardId: string, update: (card: CardInstance) => void): boolean {
  const located = findCardEverywhere(room, cardId);
  const board = located ? boardOf(room, located.playerId) : null;
  if (!located || !board) return false;
  const list = zoneList(board, located.zone);
  const index = list.findIndex((card) => card.id === cardId);
  const card = index >= 0 ? list[index] : undefined;
  if (!card) return false;
  const next = cloneCard(card);
  update(next);
  list[index] = next;
  return true;
}

export function createEngineRulesHost(ctx: RulesContext): RulesHost {
  const idFactory = makeIdFactory({
    now: ctx.now,
    rng: ctx.rng,
    mode: ctx.mode,
    ...(ctx.idFactory ? { idFactory: ctx.idFactory } : {}),
  });

  return {
    cloneRoom: (room) => structuredCloneRoom(room),
    playerIds: (room) => room.players.map((player) => player.id),
    activePlayerIds: (room) =>
      room.players.filter((player) => !!player.board && !player.leftAt).map((player) => player.id),
    playerName: (room, playerId) =>
      room.players.find((player) => player.id === playerId)?.name ?? playerId,
    turnOrder: (room) => {
      const active = room.players
        .filter((player) => !!player.board && !player.leftAt)
        .map((player) => player.id);
      return turnOrderForRoom(room, room.firstPlayerId ?? active[0] ?? "", active);
    },
    battlefieldZones: (room) =>
      battlefieldZones(room.sharedBattlefieldToken, battlefieldCount(room)),

    findCard: (room, cardId) => findCardEverywhere(room, cardId),
    zoneCards: (room, playerId, zone) => {
      const board = boardOf(room, playerId);
      return board ? readZoneList(board, zone) : [];
    },
    takeCard: (room, playerId, zone, cardId) => {
      const board = boardOf(room, playerId);
      if (!board) return null;
      if (!(CARD_ZONES as readonly string[]).includes(zone)) return null;
      const list = zoneList(board, zone);
      const index = list.findIndex((card) => card.id === cardId);
      const source = index >= 0 ? list[index] : undefined;
      if (!source) return null;
      list.splice(index, 1);
      return cloneCard(source);
    },
    putCard: (room, playerId, zone, card, index) => {
      const board = boardOf(room, playerId);
      if (!board) return false;
      if (!(CARD_ZONES as readonly string[]).includes(zone)) return false;
      const list = zoneList(board, zone);
      const at = Math.max(0, Math.min(index ?? list.length, list.length));
      list.splice(at, 0, card);
      return true;
    },
    moveCard: (room, playerId, from, to, cardId) => {
      const index = playerIndexOf(room, playerId);
      if (index < 0) return false;
      return !!engineMoveCard(room, index, { from, to, cardId });
    },
    createToken: (room, playerId, name, zone) => {
      const board = boardOf(room, playerId);
      const trimmed = name.trim().slice(0, 60);
      if (!board || !trimmed) return null;
      if (!(CARD_ZONES as readonly string[]).includes(zone)) return null;
      const id = takeCardId(undefined, allCardIds(room), idFactory);
      const imageUrl = tokenImage(trimmed);
      const type = tokenType(trimmed);
      const might = tokenMightByName(trimmed);
      const code = imageUrl?.match(/^\/cards\/([A-Z0-9-]+)\.webp$/)?.[1];
      const catalog = code ? getCard(code, trimmed) : undefined;
      const token: CardInstance = {
        id,
        name: trimmed,
        source: "token",
        ownerPlayerId: playerId,
        exhausted: tokenDefaultsExhausted(trimmed),
        createdAt: ctx.now,
        ...(imageUrl ? { imageUrl } : {}),
        ...(type ? { type } : {}),
        ...(might !== undefined ? { might } : {}),
        ...(catalog
          ? {
              cardCode: catalog.id,
              ...(catalog.keywords ? { keywords: [...catalog.keywords] } : {}),
            }
          : {}),
      };
      zoneList(board, zone).push(token);
      return id;
    },

    moveCardTo: (room, playerId, from, to, cardId, position) =>
      moveBetweenZones(room, playerId, from, to, cardId, position),
    banish: (room, cardId) => {
      const located = findCardEverywhere(room, cardId);
      return located
        ? moveBetweenZones(room, located.playerId, located.zone, "banished", cardId, "bottom")
        : false;
    },
    reveal: (room, cardId, toPlayerIds) =>
      updateCard(room, cardId, (card) => {
        card.hidden = false;
        if (toPlayerIds && toPlayerIds.length > 0) {
          card.revealedToPlayerIds = [...new Set(toPlayerIds)];
          card.revealedToOpponent = false;
        } else {
          card.revealedToOpponent = true;
          delete card.revealedToPlayerIds;
        }
      }),
    hide: (room, cardId) =>
      updateCard(room, cardId, (card) => {
        card.hidden = true;
        card.revealedToOpponent = false;
        delete card.revealedToPlayerIds;
      }),
    lookAtTop: (room, playerId, zone, count) => {
      const board = boardOf(room, playerId);
      if (!board) return [];
      const list = readZoneList(board, zone);
      const n = Math.max(0, Math.trunc(count));
      // Draw end of the array is the top of the deck.
      return list
        .slice(Math.max(0, list.length - n))
        .reverse()
        .map((card) => cloneCard(card));
    },
    searchZone: (room, playerId, zone, query) => {
      const board = boardOf(room, playerId);
      if (!board || !(CARD_ZONES as readonly string[]).includes(zone)) return [];
      const typeQuery = query?.typeIncludes?.toLowerCase();
      return readZoneList(board, zone)
        .filter((card) => {
          if (query?.name !== undefined && card.name !== query.name) return false;
          if (typeQuery) {
            const type = (card.type ?? cardForInstance(card)?.type ?? "").toLowerCase();
            if (!type.includes(typeQuery)) return false;
          }
          return true;
        })
        .map((card) => cloneCard(card));
    },
    attach: (room, gearId, unitId) => {
      const unit = findCardEverywhere(room, unitId);
      const gear = findCardEverywhere(room, gearId);
      if (!unit || !gear || gearId === unitId || !isUnitCardType(unit.card)) return false;
      const unitBoard = boardOf(room, unit.playerId);
      const gearBoard = boardOf(room, gear.playerId);
      if (!unitBoard || !gearBoard) return false;
      // 435.4: the attached card's location becomes the Top-Most card's location. Sandbox
      // `equip_card` also keeps it directly behind its host in the zone list; use that exact
      // board representation here so both modes render (and later move/detach) identically.
      const source = zoneList(gearBoard, gear.zone);
      const index = source.findIndex((card) => card.id === gearId);
      const moving = index >= 0 ? source[index] : undefined;
      if (!moving) return false;
      source.splice(index, 1);
      const destination = zoneList(unitBoard, unit.zone);
      const attached = cloneCard(moving);
      attached.attachedToCardId = unitId;
      insertAfterAttachments(destination, unitId, attached);
      return true;
    },
    detach: (room, gearId) =>
      updateCard(room, gearId, (card) => {
        delete card.attachedToCardId;
      }),
    setController: (room, cardId, playerId) => {
      const located = findCardEverywhere(room, cardId);
      if (!located) return false;
      const sourceIndex = playerIndexOf(room, located.playerId);
      const targetIndex = playerIndexOf(room, playerId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return false;
      if (
        ["base", "battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken"].includes(
          located.zone,
        )
      ) {
        return !!transferCardControl(room, sourceIndex, {
          zone: located.zone,
          cardId,
          targetPlayerId: playerId,
        });
      }
      const sourceBoard = boardOf(room, located.playerId);
      const targetBoard = boardOf(room, playerId);
      if (!sourceBoard || !targetBoard) return false;
      const source = zoneList(sourceBoard, located.zone);
      const index = source.findIndex((card) => card.id === cardId);
      const card = index >= 0 ? source[index] : undefined;
      if (!card) return false;
      source.splice(index, 1);
      zoneList(targetBoard, located.zone).push(cloneCard(card));
      return true;
    },
    adjustCounter: (room, cardId, kind, delta) => {
      const rules = room.rules;
      if (!rules) return 0;
      const object = (rules.objects[cardId] ??= {});
      const counters = (object.counters ??= {});
      const next = Math.max(0, (counters[kind] ?? 0) + Math.trunc(delta));
      if (next === 0) delete counters[kind];
      else counters[kind] = next;
      return next;
    },
    returnToHand: (room, cardId) => {
      const located = findCardEverywhere(room, cardId);
      return located
        ? moveBetweenZones(room, located.playerId, located.zone, "hand", cardId, "bottom")
        : false;
    },
    moveCardToOwnerZone: (room, cardId, zone, position) => {
      const located = findCardEverywhere(room, cardId);
      if (!located) return false;
      if (!(CARD_ZONES as readonly string[]).includes(zone)) return false;
      const ownerId = located.card.ownerPlayerId ?? located.playerId;
      // Fast path: current holder is the owner.
      if (ownerId === located.playerId) {
        return moveBetweenZones(room, ownerId, located.zone, zone, cardId, position);
      }
      // Control transfer: remove from the holder's board and put the same object on the
      // owner's board (the owner-relative part is the point of this helper).
      const sourceBoard = boardOf(room, located.playerId);
      const targetBoard = boardOf(room, ownerId);
      if (!sourceBoard || !targetBoard) return false;
      if (!(CARD_ZONES as readonly string[]).includes(located.zone)) return false;
      const source = zoneList(sourceBoard, located.zone);
      const index = source.findIndex((card) => card.id === cardId);
      const card = index >= 0 ? source[index] : undefined;
      if (!card) return false;
      source.splice(index, 1);
      const destination = zoneList(targetBoard, zone);
      const at = destinationIndex(zone, destination.length, position ?? "bottom");
      destination.splice(at, 0, card);
      return true;
    },

    draw: (room, playerId, count) => {
      const board = boardOf(room, playerId);
      if (!board) return { drawn: [], shortfall: count };
      const drawn: string[] = [];
      let popped = 0;
      for (let i = 0; i < count; i += 1) {
        const card = board.deck.pop();
        if (!card) break;
        popped += 1;
        if (isTokenOrDuplicate(card)) continue;
        const copy = cloneCard(card);
        moveCardCleanup(copy, "deck", "hand");
        board.hand.push(copy);
        drawn.push(copy.id);
      }
      return { drawn, shortfall: Math.max(0, count - popped) };
    },
    recycleTrash: (room, playerId) => {
      const board = boardOf(room, playerId);
      if (!board) return 0;
      const moved = board.trash.length;
      if (moved === 0) return 0;
      const recycled = board.trash.splice(0, board.trash.length);
      board.deck.push(...recycled);
      board.deck = shuffleIds(board.deck, { random: ctx.rng });
      return moved;
    },
    channel: (room, playerId, count) => {
      const board = boardOf(room, playerId);
      if (!board) return [];
      const ids: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const rune = board.runeDeck.pop();
        if (!rune) break;
        board.runeArea.push({ ...rune, exhausted: false });
        ids.push(rune.id);
      }
      return ids;
    },
    shuffle: (room, playerId, zone) => {
      const board = boardOf(room, playerId);
      if (!board) return;
      if (zone === "deck") board.deck = shuffleIds(board.deck, { random: ctx.rng });
      else board.runeDeck = shuffleIds(board.runeDeck, { random: ctx.rng });
    },
    readyAll: (room, playerId) => {
      const board = boardOf(room, playerId);
      if (!board) return 0;
      let readied = 0;
      for (const zone of READY_ZONES) {
        const list = readZoneList(board, zone);
        for (let index = 0; index < list.length; index += 1) {
          const card = list[index];
          if (card?.exhausted) {
            list[index] = { ...card, exhausted: false };
            readied += 1;
          }
        }
      }
      return readied;
    },
    isExhausted: (room, cardId) => findCardEverywhere(room, cardId)?.card.exhausted ?? null,
    setExhausted: (room, cardId, exhausted) => {
      const located = findCardEverywhere(room, cardId);
      if (!located) return false;
      const board = boardOf(room, located.playerId);
      if (!board) return false;
      const list = zoneList(board, located.zone);
      const index = list.findIndex((card) => card.id === cardId);
      const card = index >= 0 ? list[index] : undefined;
      if (!card) return false;
      if (!!card.exhausted === exhausted) return true;
      list[index] = { ...card, exhausted };
      return true;
    },
    unitsAt: (room, zone, playerId) => {
      const out: CardInstance[] = [];
      for (const player of room.players) {
        if (!player.board || (playerId && player.id !== playerId)) continue;
        for (const card of readZoneList(player.board, zone)) {
          if (isUnitCardType(card)) out.push(card);
        }
      }
      return out;
    },
    hasUnitAt: (room, playerId, zone) => {
      const board = boardOf(room, playerId);
      return !!board && readZoneList(board, zone).some((card) => isUnitCardType(card));
    },
    cardInfo: (room, cardId) => {
      const located = findCardEverywhere(room, cardId);
      if (!located) return null;
      const card = located.card;
      const catalog = cardForInstance(card) ?? getCard(card.cardCode, card.name);
      const info: CardInfo = {
        objectId: cardId,
        name: catalog?.name ?? card.name,
        type: catalog?.type ?? card.type ?? "Card",
        keywords: [...(card.keywords ?? catalog?.keywords ?? [])],
      };
      const might = card.might ?? catalog?.might;
      if (typeof might === "number") info.might = might;
      const energy = card.energyCost ?? catalog?.energyCost;
      if (typeof energy === "number") info.energyCost = energy;
      const power = card.powerCost ?? catalog?.powerCost;
      if (typeof power === "number") info.powerCost = power;
      const domains = card.domains ?? catalog?.domains;
      if (domains) info.domains = [...domains];
      const text = card.text ?? catalog?.text;
      if (text) info.text = text;
      return info;
    },

    score: (room, playerId) => entityScore(room, playerId),
    setScore: (room, playerId, score) => {
      setEntityScore(room, playerId, score);
    },
    gainPoints: (room, playerId, amount) => {
      const before = entityScore(room, playerId);
      setEntityScore(room, playerId, before + amount);
      return entityScore(room, playerId) - before;
    },
    victoryScore: (room) => victoryScoreForRoom(room),
    hasScored: (room, playerId, zone) => !!room.rules?.scoredThisTurn[playerId]?.includes(zone),
    markScored: (room, playerId, zone) => {
      const scored = { ...(room.rules?.scoredThisTurn ?? {}) };
      const zones = new Set(scored[playerId] ?? []);
      zones.add(zone);
      scored[playerId] = [...zones];
      if (room.rules) room.rules.scoredThisTurn = scored;
      const index = playerIndexOf(room, playerId);
      if (index >= 0) markBattlefieldScored(room, playerId, zone);
    },
    clearScored: (room) => {
      // 472: each new turn starts with a per-player empty scored-battlefield list, not `{}`.
      if (room.rules) {
        room.rules.scoredThisTurn = Object.fromEntries(
          room.players.filter((player) => !!player.board).map((player) => [player.id, []]),
        );
      }
      room.battlefieldScoredThisTurnByPlayer = undefined;
    },
    settleVictory: (room) => {
      settleRoom(room);
      return room.gameOutcome?.winnerPlayerIds ?? [];
    },

    nextTurnPlayerId: (room, currentPlayerId) => {
      const result = nextTurnPlayer(room, currentPlayerId);
      return result.room.players[result.playerIndex]?.id ?? null;
    },

    appendLog: (room, entry) => {
      const at = ctx.now;
      const text = entry.text ?? entry.key;
      const logEntry: GameplayLogEntry = {
        id: makeLogId(at, room.log.length, room.log.length),
        at,
        text,
        ...(entry.playerId ? { authorPlayerId: entry.playerId } : {}),
        turnNumber: room.turnNumber,
        turnPlayerId: room.activeTurnPlayerId,
        ...(entry.actionKind ? { actionKind: entry.actionKind } : {}),
        key: `rules.${entry.key}`,
        ...(entry.params ? { params: entry.params } : {}),
      };
      room.log.push(logEntry);
      if (room.log.length > 2000) room.log.splice(0, room.log.length - 2000);
    },
    nextId: (kind) => idFactory(kind),
    rng: () => ctx.rng(),
    now: () => ctx.now,

    // --- R2-play host additions (additive only; owner R2-play) ---

    // --- R2-effects host additions (additive only; owner R2-effects) ---
  };
}

/** Deep clone that keeps the draft boundary identical to `applyGameAction`. */
function structuredCloneRoom(room: Room): Room {
  return structuredClone(room);
}
