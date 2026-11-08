/** Deterministic random helpers for the @rift/sync property tests. */

import type {
  CardInstance,
  ChainEntry,
  GameplayLogEntry,
  PlayerBoard,
  Room,
  RoomPlayer,
  Zone,
} from "@rift/protocol";
import { BOARD_ZONES } from "./patch";

export type Rng = () => number;

/** Small seeded PRNG (mulberry32). */
export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function pick<T>(rng: Rng, values: readonly T[]): T {
  const value = values[Math.floor(rng() * values.length)];
  if (value === undefined) throw Error("pick from empty array");
  return value;
}

export function integer(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function chance(rng: Rng, probability = 0.5): boolean {
  return rng() < probability;
}

let cardCounter = 0;

export function makeCard(rng: Rng, overrides: Partial<CardInstance> = {}): CardInstance {
  cardCounter += 1;
  const suffix = `${cardCounter}_${integer(rng, 0, 9_999)}`;
  return {
    id: `card_${suffix}`,
    name: `Card ${suffix}`,
    source: "mainDeck",
    exhausted: false,
    createdAt: integer(rng, 0, 1_000_000),
    cardCode: `OGN-${integer(rng, 1, 300)}`,
    type: "Unit",
    might: integer(rng, 1, 8),
    ...overrides,
  };
}

export function makeBoard(rng: Rng, ownerPlayerId: string): PlayerBoard {
  const zone = (count: number, kind: string): CardInstance[] =>
    Array.from({ length: count }, (_, index) =>
      makeCard(rng, {
        id: `${ownerPlayerId}_${kind}_${index}_${integer(rng, 0, 99_999)}`,
        source:
          kind === "runeDeck" || kind === "runeArea"
            ? "rune"
            : kind === "champion"
              ? "champion"
              : kind === "legend"
                ? "legend"
                : "mainDeck",
        type: kind.startsWith("rune") ? "Rune" : undefined,
      }),
    );
  const board: PlayerBoard = {
    score: integer(rng, 0, 8),
    floatingEnergy: integer(rng, 0, 5),
    floatingPower: integer(rng, 0, 3),
    legendXp: integer(rng, 0, 6),
    deck: zone(integer(rng, 0, 8), "deck"),
    hand: zone(integer(rng, 0, 5), "hand"),
    handRevealToOpponent: chance(rng, 0.15),
    base: zone(integer(rng, 0, 4), "base"),
    trash: zone(integer(rng, 0, 4), "trash"),
    banished: zone(integer(rng, 0, 2), "banished"),
    battlefieldA: zone(integer(rng, 0, 3), "battlefieldA"),
    battlefieldB: zone(integer(rng, 0, 3), "battlefieldB"),
    battlefieldC: zone(integer(rng, 0, 2), "battlefieldC"),
    battlefieldToken: zone(integer(rng, 0, 1), "battlefieldToken"),
    champion: zone(integer(rng, 0, 1), "champion"),
    legend: zone(1, "legend"),
    runeDeck: zone(integer(rng, 0, 6), "runeDeck"),
    runeArea: zone(integer(rng, 0, 4), "runeArea"),
    deckPeek: {
      cardIds: zone(integer(rng, 0, 2), "peek").map((card) => card.id),
      revealedCardIds: [],
    },
  };
  if (chance(rng, 0.2)) board.recycledDeckBottomCount = integer(rng, 0, 3);
  if (chance(rng, 0.2)) board.handRevealedToPlayerIds = [];
  return board;
}

export function makePlayer(rng: Rng, seat: number): RoomPlayer {
  const id = `player_${seat}_${integer(rng, 0, 9_999)}`;
  return {
    id,
    seat,
    name: `Player ${seat}`,
    joinedAt: integer(rng, 0, 1_000_000),
    board: makeBoard(rng, id),
  };
}

export function makeChainEntry(rng: Rng, player: RoomPlayer): ChainEntry {
  return {
    id: `chain_${integer(rng, 0, 99_999)}`,
    card: makeCard(rng, { ownerPlayerId: player.id }),
    addedAt: integer(rng, 0, 1_000_000),
    fromZone: "hand",
    byPlayerId: player.id,
    byPlayerName: player.name,
  };
}

export function makeLogEntry(rng: Rng, index: number): GameplayLogEntry {
  return {
    id: `log_${index}_${integer(rng, 0, 99_999)}`,
    at: integer(rng, 0, 1_000_000) + index,
    text: `Log entry ${index}`,
    actionKind: pick(rng, ["turn", "board", "draw", "score"] as const),
  };
}

export function makeRoom(rng: Rng, playerCount = 2): Room {
  const players = Array.from({ length: playerCount }, (_, index) => makePlayer(rng, index));
  const first = players[0];
  if (!first) throw Error("room needs a player");
  return {
    roomCode: `TST${integer(rng, 100, 999)}`,
    createdAt: 1_000,
    updatedAt: integer(rng, 1_000, 5_000),
    phase: "in_game",
    gameVariant: "duel",
    roomMode: "multiplayer",
    playMode: "constructed",
    matchFormat: "bo1",
    activeTurnPlayerId: first.id,
    activeTurnStep: "main",
    turnNumber: integer(rng, 1, 6),
    players,
    log: [makeLogEntry(rng, 0), makeLogEntry(rng, 1)].slice(0, integer(rng, 0, 2)),
    chainEntries: chance(rng, 0.4) ? [makeChainEntry(rng, first)] : [],
    chainResolveVotes: [],
    targetArrowsByPlayer: chance(rng, 0.2) ? { [first.id]: [] } : undefined,
  } as Room;
}

type Mutable = Record<string, unknown>;

function boardOf(player: RoomPlayer): Mutable {
  if (!player.board) throw Error("player without board");
  return player.board as unknown as Mutable;
}

function cardsAt(player: RoomPlayer, zone: Zone): CardInstance[] {
  const value = boardOf(player)[zone];
  return Array.isArray(value) ? (value as CardInstance[]) : [];
}

/** Apply one random state mutation (keeps the value JSON-safe). */
export function mutateRoom(rng: Rng, room: Room): Room {
  const next = structuredClone(room);
  const players = next.players;
  const player = pick(rng, players);
  const board = boardOf(player);
  const zone = pick(rng, BOARD_ZONES);
  const cards = cardsAt(player, zone);
  switch (integer(rng, 0, 11)) {
    case 0: {
      // insert a new card
      cards.splice(integer(rng, 0, cards.length), 0, makeCard(rng));
      board[zone] = cards;
      break;
    }
    case 1: {
      // remove a card
      if (cards.length > 0) {
        cards.splice(integer(rng, 0, cards.length - 1), 1);
        board[zone] = cards;
      }
      break;
    }
    case 2: {
      // reorder
      if (cards.length > 1) {
        cards.reverse();
        board[zone] = cards;
      }
      break;
    }
    case 3: {
      // move between zones
      const target = pick(rng, BOARD_ZONES);
      const targetPlayer = pick(rng, players);
      if (cards.length > 0) {
        const [moved] = cards.splice(integer(rng, 0, cards.length - 1), 1);
        if (moved) {
          const targetCards = cardsAt(targetPlayer, target);
          targetCards.splice(integer(rng, 0, targetCards.length), 0, moved);
          board[zone] = cards;
          boardOf(targetPlayer)[target] = targetCards;
        }
      }
      break;
    }
    case 4: {
      // patch a card field
      if (cards.length > 0) {
        const card = pick(rng, cards) as unknown as Mutable;
        if (chance(rng, 0.5)) card.might = integer(rng, 0, 12);
        else card.customLabels = [`Label ${integer(rng, 1, 4)}`];
        if (chance(rng, 0.3)) delete card.temporaryMightBuff;
      }
      break;
    }
    case 5: {
      // board scalars / settings
      board.score = integer(rng, 0, 9);
      board.floatingEnergy = integer(rng, 0, 6);
      if (chance(rng, 0.4)) board.handRevealToOpponent = !board.handRevealToOpponent;
      if (chance(rng, 0.3)) {
        const peek = board.deckPeek as { cardIds: string[]; revealedCardIds: string[] };
        peek.cardIds = peek.cardIds.slice(0, integer(rng, 0, 2));
      }
      break;
    }
    case 6: {
      // player scalar fields
      player.name = `Renamed ${integer(rng, 0, 99)}`;
      if (chance(rng, 0.3)) player.leftAt = integer(rng, 1, 10_000);
      else delete player.leftAt;
      break;
    }
    case 7: {
      // room scalar fields
      next.updatedAt += 1;
      next.turnNumber = (next.turnNumber ?? 0) + 1;
      if (chance(rng, 0.3)) next.activeTurnPlayerId = pick(rng, players).id;
      if (chance(rng, 0.2)) {
        next.boardSettingsByPlayerId = {
          [player.id]: {
            showLegendXpCounter: chance(rng),
            stopAtBeginningPhase: chance(rng),
            skipDrawPhase: chance(rng),
            autoScoreFromHold: chance(rng),
          },
        };
      }
      break;
    }
    case 8: {
      // chain
      if (chance(rng, 0.5)) next.chainEntries.push(makeChainEntry(rng, player));
      else if (next.chainEntries.length > 0)
        next.chainEntries.splice(integer(rng, 0, next.chainEntries.length - 1), 1);
      break;
    }
    case 9: {
      // log
      if (chance(rng, 0.6)) next.log.push(makeLogEntry(rng, next.log.length));
      else if (next.log.length > 0) next.log.splice(integer(rng, 0, next.log.length - 1), 1);
      break;
    }
    case 10: {
      // add/remove an optional board field
      if (chance(rng, 0.5)) board.recycledDeckBottomCount = integer(rng, 0, 5);
      else delete board.recycledDeckBottomCount;
      break;
    }
    default: {
      // hidden reveal + deck peek reveal
      if (cards.length > 0) {
        const card = pick(rng, cards) as unknown as Mutable;
        card.hidden = !card.hidden;
      }
      break;
    }
  }
  return next;
}

export function makeLog(rng: Rng, count: number): GameplayLogEntry[] {
  return Array.from({ length: count }, (_, index) => makeLogEntry(rng, index));
}
