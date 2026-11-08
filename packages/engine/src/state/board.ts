/**
 * Board / zone primitives, ported from the original client helper modules:
 *  - 78176 (`dz`) zones, deck-peek sessions, shuffles
 *  - 437381 (`d$`) card factory / move cleanup / deck-peek clone
 *  - 822434 (`dU`) battlefield presence helpers
 *  - 375934 (`cd`) movement legality + exhaustion
 *
 * The engine works on a deep-cloned draft room, so these helpers mutate their inputs.
 * That keeps handlers readable while the transition entry preserves reference identity
 * for no-op actions (see `deepEqualRoom`).
 */
import type {
  BattlefieldZone,
  BoardZone,
  CardInstance,
  ChainEntry,
  DeckPeek,
  FieldZone,
  PlayerBoard,
  RevealableZone,
  Room,
  SharedBattlefieldToken,
  Zone,
} from "@rift/protocol";
import {
  getCard,
  isGearCardType,
  isUnitCardType,
  isGoldTokenName,
  isDeployGear,
  hasHidden,
} from "../catalog";
import { CLIENT_CARD_ID } from "./ids";

/* ------------------------------------------------------------------ zone constants */

export const BOARD_ZONES: BoardZone[] = [
  "hand",
  "base",
  "trash",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
];

export const REVEALABLE_ZONES: RevealableZone[] = [
  ...BOARD_ZONES,
  "banished",
  "champion",
  "legend",
  "runeArea",
];

export const FIELD_ZONES: FieldZone[] = [
  "base",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
];

export const BATTLEFIELD_ZONES: BattlefieldZone[] = [
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
];

export const CARD_LOCATION_ZONES: CardZoneList[] = [
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
];

export type CardZoneList = Exclude<Zone, "deck" | "runeDeck">;

export function isBoardZone(zone: string | undefined): zone is BoardZone {
  return !!zone && (BOARD_ZONES as string[]).includes(zone);
}

export function isRevealableZone(zone: string | undefined): zone is RevealableZone {
  return !!zone && (REVEALABLE_ZONES as string[]).includes(zone);
}

export function isBattlefieldZone(zone: string | undefined): zone is BattlefieldZone {
  return !!zone && (BATTLEFIELD_ZONES as string[]).includes(zone);
}

export function isFieldZone(zone: string | undefined): zone is FieldZone {
  return !!zone && (FIELD_ZONES as string[]).includes(zone);
}

/* ------------------------------------------------------------------ battlefield sets */

/** 822434 `A`: battlefield zones in display order for a variant. */
export function battlefieldZones(
  shared: SharedBattlefieldToken | undefined,
  count = 2,
): BattlefieldZone[] {
  const baron = shared?.active === true && shared.kind === "baron_pit" && shared.zone === "battlefieldToken";
  if (count === 2) return baron ? ["battlefieldA", "battlefieldToken", "battlefieldB"] : ["battlefieldA", "battlefieldB"];
  return baron ? ["battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken"] : ["battlefieldA", "battlefieldB", "battlefieldC"];
}

/** 822434 `l`: field zones (base + battlefields). */
export function fieldZones(count = 2): FieldZone[] {
  return count === 3 ? ["base", "battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken"] : ["base", "battlefieldA", "battlefieldToken", "battlefieldB"];
}

/** 822434 `L`: empty presence snapshot. */
export function emptyPresence(turnNumber?: number): Record<BattlefieldZone, boolean> & { turnNumber?: number } {
  return {
    battlefieldA: false,
    battlefieldB: false,
    battlefieldC: false,
    battlefieldToken: false,
    ...(turnNumber !== undefined ? { turnNumber } : {}),
  };
}

/* ------------------------------------------------------------------ card access */

export function cloneCard(card: CardInstance): CardInstance {
  const copy: CardInstance = { ...card };
  if (card.domains) copy.domains = [...card.domains];
  if (card.keywords) copy.keywords = [...card.keywords];
  if (card.subtypes) copy.subtypes = [...card.subtypes];
  if (card.customLabels) copy.customLabels = [...card.customLabels];
  if (card.revealedToPlayerIds) copy.revealedToPlayerIds = [...card.revealedToPlayerIds];
  if (card.oriannaAnimation) copy.oriannaAnimation = { ...card.oriannaAnimation };
  return copy;
}

export function cloneBoard(board: PlayerBoard): PlayerBoard {
  const copy: PlayerBoard = {
    ...board,
    deck: board.deck.map(cloneCard),
    hand: board.hand.map(cloneCard),
    base: board.base.map(cloneCard),
    trash: board.trash.map(cloneCard),
    banished: board.banished.map(cloneCard),
    battlefieldA: board.battlefieldA.map(cloneCard),
    battlefieldB: board.battlefieldB.map(cloneCard),
    battlefieldC: (board.battlefieldC ?? []).map(cloneCard),
    battlefieldToken: board.battlefieldToken.map(cloneCard),
    champion: board.champion.map(cloneCard),
    legend: board.legend.map(cloneCard),
    runeDeck: board.runeDeck.map(cloneCard),
    runeArea: board.runeArea.map(cloneCard),
    deckPeek: cloneDeckPeek(board),
  };
  if (board.additionalLegends) copy.additionalLegends = board.additionalLegends.map(cloneCard);
  if (board.handRevealedToPlayerIds) copy.handRevealedToPlayerIds = [...board.handRevealedToPlayerIds];
  return copy;
}

/** Generic deep clone preserving `undefined`-valued keys (room state has no functions). */
export function deepClone<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => deepClone(item)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = deepClone(item);
    }
    return out as T;
  }
  return value;
}

export function cloneRoom(room: Room): Room {
  return deepClone(room);
}

/** 78176 `h`: zone list (deck/runeDeck are not card zones). */
export function zoneList(board: PlayerBoard, zone: string): CardInstance[] {
  switch (zone) {
    case "hand":
      return board.hand;
    case "base":
      return board.base;
    case "battlefieldA":
      return board.battlefieldA;
    case "battlefieldB":
      return board.battlefieldB;
    case "battlefieldC":
      return board.battlefieldC ?? (board.battlefieldC = []);
    case "battlefieldToken":
      return board.battlefieldToken;
    case "trash":
      return board.trash;
    case "banished":
      return board.banished ?? (board.banished = []);
    case "champion":
      return board.champion;
    case "legend":
      return board.legend;
    case "runeArea":
      return board.runeArea;
    case "deck":
      return board.deck;
    case "runeDeck":
      return board.runeDeck;
    default:
      return [];
  }
}

/** Non-mutating zone read (unlike `zoneList`, never creates a missing optional array). */
export function readZoneList(board: PlayerBoard, zone: string): CardInstance[] {
  switch (zone) {
    case "battlefieldC":
      return board.battlefieldC ?? [];
    case "banished":
      return board.banished ?? [];
    default:
      return zoneList(board, zone);
  }
}

export function zoneListOrNull(board: PlayerBoard, zone: string): CardInstance[] | null {
  if (zone === "deck" || zone === "runeDeck" || isRevealableZone(zone)) return zoneList(board, zone);
  return null;
}

export function findCardInZone(board: PlayerBoard, zone: string, cardId: string): CardInstance | undefined {
  return zoneList(board, zone).find((card) => card.id === cardId);
}

/** 437381 `k`: find a card across every card zone (not deck/runeDeck). */
export function findCardAnywhere(
  board: PlayerBoard,
  cardId: string,
): { zone: CardZoneList; index: number; card: CardInstance } | null {
  for (const zone of CARD_LOCATION_ZONES) {
    const list = zoneList(board, zone);
    const index = list.findIndex((card) => card.id === cardId);
    if (index >= 0) {
      const card = list[index];
      if (card) return { zone, index, card };
    }
  }
  return null;
}

/** 437381 `A`: insert after the target card and its attached cards. */
export function insertAfterAttachments(list: CardInstance[], cardId: string, card: CardInstance): void {
  const index = list.findIndex((item) => item.id === cardId);
  if (index < 0) {
    list.push(card);
    return;
  }
  let next = index + 1;
  while (next < list.length && list[next]?.attachedToCardId === cardId) next += 1;
  list.splice(next, 0, card);
}

/** 437381 `z` / `x`: remove attachment links to cards. */
export function detachAttachmentsFrom(room: Room, cardIds: ReadonlySet<string>): void {
  if (cardIds.size === 0) return;
  for (const player of room.players) {
    const board = player.board;
    if (!board) continue;
    for (const zone of CARD_LOCATION_ZONES) {
      const list = zoneList(board, zone);
      for (let i = 0; i < list.length; i += 1) {
        const card = list[i];
        if (!card) continue;
        if (card.attachedToCardId && cardIds.has(card.attachedToCardId)) {
          const copy = cloneCard(card);
          delete copy.attachedToCardId;
          list[i] = copy;
        }
      }
    }
  }
}

/** 437381 `g`: detach gear whose host was removed. */
export function detachAttachmentsFromCards(room: Room, cardIds: ReadonlySet<string>): Room {
  detachAttachmentsFrom(room, cardIds);
  return room;
}

/* ------------------------------------------------------------------ reveal helpers */

/** 437381 `u` / `p`: clear reveal flags. */
export function clearReveals(card: CardInstance): void {
  if ("revealedToPlayerIds" in card) delete card.revealedToPlayerIds;
  if ("revealedToOpponent" in card) delete card.revealedToOpponent;
}

/** 437381 `K` / `y`: clear hidden + reveal flags. */
export function clearHidden(card: CardInstance): void {
  if ("hidden" in card) delete card.hidden;
  clearReveals(card);
}

/** 437381 `D` / `k`: reset a card entering hand/trash/banished. */
export function clearPileCard(card: CardInstance): void {
  if (card.neekoLegendControllerId !== undefined) card.neekoLegendControllerId = null;
  // Restore Orianna's previous type/might/counter.
  const animation = card.oriannaAnimation;
  if (animation) {
    for (const key of ["type", "might", "whiteCounter"] as const) {
      const value = animation[key];
      if (value === undefined) delete card[key];
      else (card as unknown as Record<string, unknown>)[key] = value;
    }
    delete card.oriannaAnimation;
  }
  if ("temporaryMightBuff" in card) delete card.temporaryMightBuff;
  if ("whiteCounter" in card) delete card.whiteCounter;
  if ("redCounter" in card) delete card.redCounter;
  if ("customLabels" in card) delete card.customLabels;
  if ("empowerTriggerUsed" in card) delete card.empowerTriggerUsed;
  clearReveals(card);
}

/* ------------------------------------------------------------------ movement cleanup */

/**
 * 375934 `_` / `cd._`: destination exhaustion + hidden reveal rules.
 * `isUnit` mirrors the original injected `isUnitCardType`.
 */
export function applyDestinationExhaustion(
  card: CardInstance,
  from: string,
  to: string,
  isUnit: (card: CardInstance) => boolean = isUnitCardType,
): void {
  if (card.hidden && from !== to && !isBattlefieldZone(to)) card.hidden = false;
  if (to === "champion") {
    card.exhausted = false;
    return;
  }
  if (from !== to) {
    if (card.hidden && isBattlefieldZone(to)) {
      card.exhausted = false;
      return;
    }
    if (to !== "runeArea") {
      if (to === "trash" || to === "banished" || to === "hand") {
        card.exhausted = false;
        return;
      }
      if ((to === "base" || isBattlefieldZone(to)) && isUnit(card)) card.exhausted = true;
    }
  }
}

/**
 * 437381 `b` / `d$.b`: full cleanup when a card changes zone.
 * `controllerId` sets the Neeko controller marker for copies entering the field.
 */
export function moveCardCleanup(
  card: CardInstance,
  from: string,
  to: string,
  options: { isUnitCardType?: (card: CardInstance) => boolean; controllerId?: string } = {},
): void {
  applyDestinationExhaustion(card, from, to, options.isUnitCardType ?? isUnitCardType);
  if (from === to) return;
  if (!isFieldZone(to) && (isNeekoLegend(card) || card.neekoLegendControllerId !== undefined)) {
    card.neekoLegendControllerId = null;
  } else if (isFieldZone(to) && (from === "hand" || from === "champion" || from === "trash" || from === "banished" || from === "deck")) {
    if (isNeekoLegend(card) || card.neekoLegendControllerId !== undefined) {
      card.neekoLegendControllerId = null;
    }
    if (options.controllerId && !card.hidden) setNeekoController(card, options.controllerId);
  }
  delete card.banishedByCardId;
  delete card.banishedByHiddenSourcePlayerId;
  delete card.banishedUntilEndingPlayerId;
  clearReveals(card);
  if (to === "hand" || to === "trash" || to === "banished") clearPileCard(card);
}

/** 514890 `s`: is this the Neeko legend card? */
export function isNeekoLegend(card: CardInstance): boolean {
  const name = getCard(card.cardCode, card.name)?.name ?? card.name;
  return name.trim() === "Neeko, Blending In";
}

/** 514890 `v`: mark a Neeko legend's controller. */
export function setNeekoController(card: CardInstance, playerId: string): void {
  if (isNeekoLegend(card)) card.neekoLegendControllerId = playerId;
}

/* ------------------------------------------------------------------ deck peek */

export function deckPeekZone(peek: DeckPeek | undefined): "deck" | "runeDeck" {
  return peek?.zone === "runeDeck" ? "runeDeck" : "deck";
}

export function peekList(board: PlayerBoard, zone: "deck" | "runeDeck"): CardInstance[] {
  return zone === "runeDeck" ? board.runeDeck : board.deck;
}

export function revealedSubset(peek: DeckPeek | undefined): string[] {
  const ids = peek?.cardIds ?? [];
  const revealed = new Set(peek?.revealedCardIds ?? []);
  return ids.filter((id) => revealed.has(id));
}

/** 78176 `O`: recycled bottom count clamped to deck length. */
export function recycledBottomCount(board: PlayerBoard): number {
  const raw = board.recycledDeckBottomCount;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(board.deck.length, Math.floor(raw));
}

/** 78176 `y`: set recycled bottom count (0 removes the field). */
export function setRecycledBottomCount(board: PlayerBoard, value: number): void {
  const next = Number.isFinite(value) ? Math.min(board.deck.length, Math.max(0, Math.floor(value))) : 0;
  if (next === 0) delete board.recycledDeckBottomCount;
  else board.recycledDeckBottomCount = next;
}

/** 78176 `Z`: reset deck peek completely. */
export function resetDeckPeek(board: PlayerBoard): void {
  board.deckPeek.cardIds = [];
  board.deckPeek.revealedCardIds = [];
  delete board.deckPeek.zone;
  delete board.deckPeek.autoRevealNewCards;
}

/** 78176 `x`: drop peeked ids that are no longer in the peeked zone. */
export function pruneDeckPeek(board: PlayerBoard): void {
  if (!board.deckPeek) board.deckPeek = { cardIds: [], revealedCardIds: [] };
  const list = peekList(board, deckPeekZone(board.deckPeek));
  board.deckPeek.cardIds = board.deckPeek.cardIds.filter((id) => list.some((card) => card.id === id));
  board.deckPeek.revealedCardIds = revealedSubset(board.deckPeek);
  if (board.deckPeek.cardIds.length === 0) {
    board.deckPeek.revealedCardIds = [];
    delete board.deckPeek.zone;
    delete board.deckPeek.autoRevealNewCards;
  } else if (board.deckPeek.autoRevealNewCards) {
    board.deckPeek.revealedCardIds = [...board.deckPeek.cardIds];
  } else {
    delete board.deckPeek.autoRevealNewCards;
  }
}

/** 437381 `v` / `d$.v`: clone the peek session (used by every peek handler). */
export function cloneDeckPeek(board: PlayerBoard): DeckPeek {
  const zone = deckPeekZone(board.deckPeek);
  return {
    ...(zone === "runeDeck" ? { zone: "runeDeck" as const } : {}),
    cardIds: [...(board.deckPeek?.cardIds ?? [])],
    revealedCardIds: revealedSubset(board.deckPeek),
    ...(board.deckPeek?.autoRevealNewCards ? { autoRevealNewCards: true } : {}),
    ...(board.deckPeek?.revision !== undefined ? { revision: board.deckPeek.revision } : {}),
  };
}

/** 437381 `W` / `d$.W`: clear the deck peek unless a rune-deck peek is open. */
export function clearBoardPeekUnlessRune(board: PlayerBoard): void {
  if (deckPeekZone(board.deckPeek) === "runeDeck") return;
  if (
    (board.deckPeek?.cardIds?.length ?? 0) === 0 &&
    (board.deckPeek?.revealedCardIds?.length ?? 0) === 0 &&
    !board.deckPeek?.autoRevealNewCards &&
    board.deckPeek?.zone === undefined
  ) {
    return;
  }
  board.deckPeek = {
    cardIds: [],
    revealedCardIds: [],
    ...(board.deckPeek?.revision !== undefined ? { revision: board.deckPeek.revision } : {}),
  };
}

/** 78176 `F`: is auto-reveal enabled for a non-empty peek? */
export function isAutoRevealPeek(peek: DeckPeek | undefined): boolean {
  return (peek?.cardIds.length ?? 0) > 0 && !!peek?.autoRevealNewCards;
}

/* ------------------------------------------------------------------ shuffle */

/** 78176 `P`: deterministic Fisher-Yates with either an RNG or a seed key. */
export function shuffleIds<T>(
  items: readonly T[],
  options: { random?: () => number; seedKey?: string } = {},
): T[] {
  const out = [...items];
  if (out.length < 2) return out;
  if (options.random) {
    const random = options.random;
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const a = out[i];
      const b = out[j];
      if (a !== undefined && b !== undefined) {
        out[i] = b;
        out[j] = a;
      }
    }
    return out;
  }
  if (options.seedKey) {
    let seed = 1;
    for (let i = 0; i < options.seedKey.length; i += 1) {
      seed = (31 * seed + options.seedKey.charCodeAt(i)) % 0x7fffffff;
    }
    if (!seed) seed = 1;
    const random = () => {
      seed = (48271 * seed) % 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const a = out[i];
      const b = out[j];
      if (a !== undefined && b !== undefined) {
        out[i] = b;
        out[j] = a;
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ presence */

/** 357603 `E`: does the zone contain a non-hidden unit? */
export function hasUnitAt(board: PlayerBoard, zone: string): boolean {
  return zoneList(board, zone).some((card) => !card.hidden && isUnitCardType(card));
}

/** 357603 `f`: per-player battlefield presence snapshot. */
export function battlefieldPresence(
  room: Room,
  battlefieldCount = 2,
): Record<string, Record<BattlefieldZone, boolean>> {
  const zones = battlefieldZones(room.sharedBattlefieldToken, battlefieldCount);
  const out: Record<string, Record<BattlefieldZone, boolean>> = {};
  for (const player of room.players) {
    if (!player.board) continue;
    const map = emptyPresence();
    for (const zone of zones) map[zone] = hasUnitAt(player.board, zone);
    out[player.id] = map;
  }
  return out;
}

/* ------------------------------------------------------------------ ids / cards */

/** 437381 `o`: every card id currently on a board or chain. */
export function allCardIds(room: Room): Set<string> {
  const ids = new Set<string>();
  for (const player of room.players) {
    const board = player.board;
    if (!board) continue;
    for (const zone of [...CARD_LOCATION_ZONES, "deck", "runeDeck"] as const) {
      for (const card of zoneList(board, zone)) ids.add(card.id);
    }
    for (const card of board.additionalLegends ?? []) ids.add(card.id);
  }
  for (const entry of room.chainEntries) ids.add(entry.card.id);
  return ids;
}

/** 437381 `H`: choose the client-requested id when valid, else mint a fresh one. */
export function takeCardId(
  requested: string | undefined,
  unavailable: Set<string>,
  idFactory: (kind: string) => string,
): string {
  const trimmed = requested?.trim() ?? "";
  if (trimmed.length > 0 && CLIENT_CARD_ID.test(trimmed) && !unavailable.has(trimmed)) {
    unavailable.add(trimmed);
    return trimmed;
  }
  const id = idFactory("card");
  unavailable.add(id);
  return id;
}

/* ------------------------------------------------------------------ equality */

/** 437381-style structural equality; keys with `undefined` values are ignored. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;
  const aKeys = Object.keys(a as Record<string, unknown>)
    .filter((key) => (a as Record<string, unknown>)[key] !== undefined)
    .sort();
  const bKeys = Object.keys(b as Record<string, unknown>)
    .filter((key) => (b as Record<string, unknown>)[key] !== undefined)
    .sort();
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key, index) => key === bKeys[index] && deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

export function deepEqualRoom(a: Room, b: Room): boolean {
  return deepEqual(a, b);
}

/* ------------------------------------------------------------------ chain helpers */

export function chainCard(entry: ChainEntry): CardInstance {
  return entry.card;
}

export function isTokenOrDuplicate(card: CardInstance): boolean {
  return card.source === "token" || !!card.isDuplicate;
}

export function isEquipment(card: CardInstance): boolean {
  return isGearCardType(card) && !isUnitCardType(card) && !isDeployGear(card);
}

export function isGoldToken(card: CardInstance): boolean {
  return card.source === "token" && isGoldTokenName(card.name ?? "");
}

export function isHiddenCard(card: CardInstance): boolean {
  return !!card.hidden && hasHidden(card);
}

export function emptyBoard(score = 0): PlayerBoard {
  return {
    score,
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
