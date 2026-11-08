/**
 * `RulesHost` — the board/zone primitives @rift/rules needs from @rift/engine.
 *
 * The strict layer owns timing, priority, chain and rules state; it never re-implements the
 * engine's zone logic. @rift/engine injects the one implementation (`src/strict/host.ts`) so
 * both layers share the exact same card movement/cleanup semantics.
 */
import type { BattlefieldZone, CardInstance, GameplayLogEntry, Room } from "@rift/protocol";

/** Same shape as the engine's `ActionContext` (time/rng/ids are always injected). */
export interface RulesContext {
  now: number;
  rng: () => number;
  mode: "multiplayer" | "solo_lab" | "single_player";
  idFactory?: (kind: string) => string;
}

export interface LocatedCard {
  playerId: string;
  zone: string;
  index: number;
  card: CardInstance;
}

export interface DrawOutcome {
  /** Ids actually moved to hand. */
  drawn: string[];
  /** How many of the requested draws could not be completed (432.1). */
  shortfall: number;
}

export interface CardInfo {
  /** Stable object id (the card instance id), for layers/effective keywords. */
  objectId?: string;
  name: string;
  type: string;
  keywords: string[];
  might?: number;
  energyCost?: number;
  powerCost?: number;
  domains?: string[];
  text?: string;
}

export interface RulesLogEntry {
  key: string;
  params?: Record<string, string | number | null | undefined>;
  text?: string;
  playerId?: string;
  actionKind?: GameplayLogEntry["actionKind"];
}

/**
 * All methods mutate the draft room/state they receive. `@rift/rules` clones once at the
 * intent boundary, exactly like `applyGameAction`.
 */
export interface RulesHost {
  /* room */
  cloneRoom(room: Room): Room;
  playerIds(room: Room): string[];
  activePlayerIds(room: Room): string[];
  playerName(room: Room, playerId: string): string;
  turnOrder(room: Room): string[];
  battlefieldZones(room: Room): BattlefieldZone[];

  /* cards / zones */
  findCard(room: Room, cardId: string): LocatedCard | null;
  zoneCards(room: Room, playerId: string, zone: string): CardInstance[];
  /** Remove and return a detached clone (used to put cards on the chain). */
  takeCard(room: Room, playerId: string, zone: string, cardId: string): CardInstance | null;
  putCard(room: Room, playerId: string, zone: string, card: CardInstance, index?: number): boolean;
  moveCard(room: Room, playerId: string, from: string, to: string, cardId: string): boolean;
  createToken(room: Room, playerId: string, name: string, zone: string): string | null;

  /* generic zone operations (frozen for wave R2) */
  /**
   * Move a card between any two zones (hand/base/battlefields/trash/banished/champion/legend/
   * runeArea/deck/runeDeck) with an optional list position. For deck/runeDeck, `"top"` is the
   * draw end. Does not apply engine play-movement restrictions — effect text uses this only for
   * explicit "return/mill/put" actions.
   */
  moveCardTo(
    room: Room,
    playerId: string,
    from: string,
    to: string,
    cardId: string,
    position?: "top" | "bottom" | number,
  ): boolean;
  /** Move a card to its owner's Banished zone (412 "banish"). */
  banish(room: Room, cardId: string): boolean;
  /** Reveal a card to the given players, or to every opponent when omitted (412 "reveal"). */
  reveal(room: Room, cardId: string, toPlayerIds?: string[]): boolean;
  /** Remove any reveal flags from a card (face-down/hidden helper). */
  hide(room: Room, cardId: string): boolean;
  /** Look at the top `count` cards of a deck/runeDeck, top-first, without changing the zone. */
  lookAtTop(room: Room, playerId: string, zone: "deck" | "runeDeck", count: number): CardInstance[];
  /** Search a zone by exact name and/or type substring (412 "search"). Returns clones. */
  searchZone(
    room: Room,
    playerId: string,
    zone: string,
    query?: { name?: string; typeIncludes?: string },
  ): CardInstance[];
  /** Attach a Gear card to a Unit (`attachedToCardId`). */
  attach(room: Room, gearId: string, unitId: string): boolean;
  /** Detach a Gear card from its host. */
  detach(room: Room, gearId: string): boolean;
  /** Move control of a card to another player (same zone). */
  setController(room: Room, cardId: string, playerId: string): boolean;
  /** Add/remove a counter on `rules.objects[cardId].counters`; returns the new value. */
  adjustCounter(room: Room, cardId: string, kind: string, delta: number): number;
  /** Move a card from any zone to its owner's hand (412 "return to hand"). */
  returnToHand(room: Room, cardId: string): boolean;
  /**
   * Owner-relative zone move (412 "return to owner's hand/trash/deck", "banish"): take the card
   * from wherever it currently is (controller-relative zone) and put it into the **owner's**
   * `zone`, regardless of who controls it. `position` has the same meaning as `moveCardTo`.
   */
  moveCardToOwnerZone(
    room: Room,
    cardId: string,
    zone: string,
    position?: "top" | "bottom" | number,
  ): boolean;

  /* turn / resources */
  draw(room: Room, playerId: string, count: number): DrawOutcome;
  recycleTrash(room: Room, playerId: string): number;
  channel(room: Room, playerId: string, count: number): string[];
  shuffle(room: Room, playerId: string, zone: "deck" | "runeDeck"): void;
  readyAll(room: Room, playerId: string): number;
  isExhausted(room: Room, cardId: string): boolean | null;
  setExhausted(room: Room, cardId: string, exhausted: boolean): boolean;
  unitsAt(room: Room, zone: string, playerId?: string): CardInstance[];
  hasUnitAt(room: Room, playerId: string, zone: string): boolean;
  cardInfo(room: Room, cardId: string): CardInfo | null;

  /* score / victory */
  score(room: Room, playerId: string): number;
  setScore(room: Room, playerId: string, score: number): void;
  gainPoints(room: Room, playerId: string, amount: number): number;
  victoryScore(room: Room): number;
  hasScored(room: Room, playerId: string, zone: BattlefieldZone): boolean;
  markScored(room: Room, playerId: string, zone: BattlefieldZone): void;
  clearScored(room: Room): void;
  /** 323.1/474: run the engine's victory settle and return the winner ids (empty = none). */
  settleVictory(room: Room): string[];

  /* turn queue (734–738) */
  nextTurnPlayerId(room: Room, currentPlayerId: string): string | null;

  /* log / ids / rng */
  appendLog(room: Room, entry: RulesLogEntry): void;
  nextId(kind: string): string;
  rng(): number;
  now(): number;

  // --- R2-play host additions (additive only; owner R2-play) ---

  // --- R2-effects host additions (additive only; owner R2-effects) ---
}
