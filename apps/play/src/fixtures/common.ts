import type { CardInstance, GameplayLogEntry, PlayerBoard, Room, RoomPlayer } from "@rift/protocol";

export interface CardSeed extends Partial<CardInstance> {
  id: string;
  name: string;
}

let createdAtCursor = 1;

/** Build a CardInstance with the original required defaults. */
export function makeCard(seed: CardSeed): CardInstance {
  const source = seed.source ?? "mainDeck";
  return {
    id: seed.id,
    name: seed.name,
    source,
    exhausted: seed.exhausted ?? false,
    createdAt: seed.createdAt ?? createdAtCursor++,
    ownerPlayerId: seed.ownerPlayerId,
    cardCode: seed.cardCode,
    type: seed.type,
    domains: seed.domains,
    energyCost: seed.energyCost,
    powerCost: seed.powerCost,
    might: seed.might,
    text: seed.text,
    keywords: seed.keywords,
    subtypes: seed.subtypes,
    rarity: seed.rarity,
    set: seed.set,
    hidden: seed.hidden,
    isPlaceholder: seed.isPlaceholder,
    customLabels: seed.customLabels,
    temporaryMightBuff: seed.temporaryMightBuff,
    whiteCounter: seed.whiteCounter,
    redCounter: seed.redCounter,
    attachedToCardId: seed.attachedToCardId,
    isDuplicate: seed.isDuplicate,
    imageUrl: seed.imageUrl,
  };
}

const RUNE_BY_DOMAIN: Record<string, { code: string; name: string }> = {
  Fury: { code: "OGN-007", name: "Fury Rune" },
  Calm: { code: "OGN-042", name: "Calm Rune" },
  Mind: { code: "OGN-089", name: "Mind Rune" },
  Body: { code: "OGN-126", name: "Body Rune" },
  Chaos: { code: "OGN-166", name: "Chaos Rune" },
  Order: { code: "OGN-214", name: "Order Rune" },
};

export function rune(domain: keyof typeof RUNE_BY_DOMAIN, index: number, exhausted = false): CardInstance {
  const info = RUNE_BY_DOMAIN[domain] ?? RUNE_BY_DOMAIN.Fury!;
  return makeCard({
    id: `rune-${domain.toLowerCase()}-${index}`,
    name: info.name,
    source: "rune",
    cardCode: info.code,
    type: "Rune",
    domains: [domain],
    keywords: [],
    exhausted,
  });
}

export function fillerDeck(prefix: string, count: number): CardInstance[] {
  return Array.from({ length: count }, (_, index) =>
    makeCard({
      id: `${prefix}-${index}`,
      name: `Deck card ${index + 1}`,
      source: "mainDeck",
      isPlaceholder: true,
    }),
  );
}

export function emptyBoard(overrides: Partial<PlayerBoard> = {}): PlayerBoard {
  return {
    score: 0,
    floatingEnergy: 0,
    floatingPower: 0,
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
    ...overrides,
  };
}

export function makePlayer(input: {
  id: string;
  seat: number;
  name: string;
  board: PlayerBoard;
}): RoomPlayer {
  return {
    id: input.id,
    seat: input.seat,
    name: input.name,
    joinedAt: 1,
    board: input.board,
  };
}

export function makeLog(text: string, turnNumber: number, index: number): GameplayLogEntry {
  return {
    id: `log-${index}`,
    at: 1000 + index * 1000,
    text,
    turnNumber,
    actionKind: "board",
  };
}

export function makeRoom(input: {
  roomCode: string;
  players: RoomPlayer[];
  firstPlayerId: string;
  activeTurnPlayerId: string;
  turnNumber: number;
  variant?: Room["gameVariant"];
  log?: GameplayLogEntry[];
  extra?: Partial<Room>;
}): Room {
  return {
    roomCode: input.roomCode,
    createdAt: 1,
    updatedAt: 2,
    phase: "in_game",
    gameVariant: input.variant ?? "duel",
    roomMode: "multiplayer",
    playMode: "constructed",
    deckRulesMode: "standard",
    matchFormat: "bo1",
    gameNumber: 1,
    firstPlayerId: input.firstPlayerId,
    activeTurnPlayerId: input.activeTurnPlayerId,
    activeTurnStep: "main",
    turnNumber: input.turnNumber,
    players: input.players,
    log: input.log ?? [],
    chainEntries: [],
    chainResolveVotes: [],
    mulliganDonePlayerIds: input.players.map((player) => player.id),
    ...input.extra,
  };
}

/* ------------------------------------------------------------ set cards */

export const CARDS = {
  rebuke: () =>
    makeCard({
      id: "hero-hand-rebuke",
      name: "Rebuke",
      source: "mainDeck",
      cardCode: "OGN-172",
      type: "Spell",
      domains: ["Chaos"],
      energyCost: 2,
      powerCost: 2,
      might: 0,
      text: "[Action] (Play on your turn or in showdowns.)\nReturn a unit at a battlefield to its owner's hand.",
      keywords: ["Action"],
      rarity: "Uncommon",
      set: "Origins",
    }),
  jhin: () =>
    makeCard({
      id: "hero-hand-jhin",
      name: "Jhin, Murderous Artist",
      source: "mainDeck",
      cardCode: "UNL-022A",
      type: "Unit",
      domains: ["Fury"],
      energyCost: 4,
      might: 4,
      text: "When I attack, deal 1 to a unit here.",
      keywords: [],
      rarity: "Rare",
      set: "Unleashed",
      subtypes: ["Jhin", "Ionia"],
    }),
  poroHerder: () =>
    makeCard({
      id: "hero-hand-poro",
      name: "Poro Herder",
      source: "mainDeck",
      cardCode: "OGN-061",
      type: "Unit",
      domains: ["Calm"],
      energyCost: 3,
      might: 3,
      text: "When I enter, create a Recruit token.",
      keywords: [],
      rarity: "Common",
      set: "Origins",
      subtypes: ["Freljord"],
    }),
  treasureHunter: () =>
    makeCard({
      id: "hero-hand-treasure",
      name: "Treasure Hunter",
      source: "mainDeck",
      cardCode: "SFD-130",
      type: "Unit",
      domains: ["Chaos"],
      energyCost: 2,
      might: 1,
      text: "When I enter, draw 1.",
      keywords: [],
      rarity: "Common",
      set: "Spiritforged",
    }),
  fiora: () =>
    makeCard({
      id: "hero-hand-fiora",
      name: "Fiora, Victorious",
      source: "mainDeck",
      cardCode: "OGN-232",
      type: "Unit",
      domains: ["Order"],
      energyCost: 4,
      might: 4,
      text: "When I conquer, draw 1.",
      keywords: [],
      rarity: "Rare",
      set: "Origins",
      subtypes: ["Fiora", "Demacia"],
    }),
  blazingScorcher: (id = "hero-bf-opponent-unit") =>
    makeCard({
      id,
      name: "Blazing Scorcher",
      source: "mainDeck",
      cardCode: "OGN-001",
      type: "Unit",
      domains: ["Fury"],
      energyCost: 5,
      might: 5,
      text: "[Accelerate] (You may pay [1] [Fury] as an additional cost to have me enter ready.)",
      keywords: ["Accelerate"],
      rarity: "Common",
      set: "Origins",
      subtypes: ["Noxus", "Dragon"],
    }),
  kaisa: (id = "hero-self-unit") =>
    makeCard({
      id,
      name: "Kai'Sa, Survivor",
      source: "mainDeck",
      cardCode: "OGN-039",
      type: "Unit",
      domains: ["Fury"],
      energyCost: 4,
      might: 4,
      text: "[Accelerate] (You may pay [1] [Fury] as an additional cost to have me enter ready.)\nWhen I conquer, draw 1.",
      keywords: ["Accelerate"],
      rarity: "Rare",
      set: "Origins",
      subtypes: ["Kai'Sa", "The Void"],
    }),
  hiddenUnit: (id = "hero-bf-hidden-unit") =>
    makeCard({
      id,
      name: "Hidden unit",
      source: "mainDeck",
      hidden: true,
      isPlaceholder: true,
    }),
  recruitToken: () =>
    makeCard({
      id: "hero-base-recruit",
      name: "Recruit",
      source: "token",
      type: "Unit",
      domains: [],
      energyCost: 0,
      might: 1,
      text: "",
      keywords: [],
      customLabels: [],
    }),
};

export function heroLog(): GameplayLogEntry[] {
  return [
    makeLog("Played Rebuke from hand.", 5, 0),
    makeLog("Paid 2 — Exhaust 2 · Recycle 2.", 5, 1),
    makeLog("Dismissed showdown at Grove of the God-Willow.", 5, 2),
    makeLog("Moved Kai'Sa, Survivor to Grove of the God-Willow.", 5, 3),
    makeLog("Paid 1 — Exhaust 1.", 5, 4),
  ];
}
