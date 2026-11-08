/**
 * Deterministic in-game fixtures for the heavy oracle fuzz (duel + every multiplayer variant).
 *
 * Built with the same primitives as `.recon/oracle/fixtures/build-fixtures.mjs`: the original
 * `sz()` setup-card factory, the original seeded shuffle (`78176.P`) and the original turn-start
 * (`70094.k`). On top of that a handful of cards are injected so every action handler has at
 * least one realistic precondition available (Orianna/Neeko/Ivern/Dockside/Kharox helpers,
 * Time Warp, [Repeat]/[Flow] spells, hidden cards, linked banish pile, trash, hand spells).
 */
import fs from "node:fs";
import path from "node:path";
import type {
  FixtureDecks,
  OracleCard,
  OriginalEngine,
  OracleRoom,
  DeckSections,
} from "../../../../.recon/oracle/load.mjs";
import type { Room } from "@rift/protocol";

export type FuzzVariant = "duel" | "free_for_all_3" | "free_for_all_4" | "teams_2v2";

export const FUZZ_VARIANTS: FuzzVariant[] = [
  "duel",
  "free_for_all_3",
  "free_for_all_4",
  "teams_2v2",
];

const ROOT = path.resolve(__dirname, "../../../..");
const DECKS = path.join(ROOT, ".recon/oracle/fixtures/decks.json");
const BASE_TIME = 1760000000000;
const SEED_KEY = "riftbound-oracle-fuzz-v1";
const NAMES = ["Alice", "Bob", "Cara", "Dane"];

type Sections = DeckSections;

function loadDecks(): FixtureDecks {
  return JSON.parse(fs.readFileSync(DECKS, "utf8")) as FixtureDecks;
}

function boardFromDeck(original: OriginalEngine, sections: Sections, playerId: string, createdAt: number) {
  const { sz } = original.raw;
  const card = (source: "mainDeck" | "champion" | "legend" | "rune", entries: Sections["mainDeck"]) =>
    sz({ entries, ownerPlayerId: playerId, source, createdAt }) as unknown as OracleCard[];
  return {
    score: 0,
    floatingEnergy: 0,
    floatingPower: 0,
    legendXp: 0,
    deck: card("mainDeck", sections.mainDeck),
    hand: [] as OracleCard[],
    handRevealToOpponent: false,
    base: [] as OracleCard[],
    trash: [] as OracleCard[],
    banished: [] as OracleCard[],
    battlefieldA: [] as OracleCard[],
    battlefieldB: [] as OracleCard[],
    battlefieldC: [] as OracleCard[],
    battlefieldToken: [] as OracleCard[],
    champion: card("champion", sections.champion),
    legend: card("legend", sections.legend.slice(0, 1)),
    additionalLegends: [] as OracleCard[],
    runeDeck: card("rune", sections.runes),
    runeArea: [] as OracleCard[],
    deckPeek: { cardIds: [] as string[], revealedCardIds: [] as string[] },
  };
}

/** One original-shaped card (`sz`), renamed so injected instances stay unique. */
function setupCard(original: OriginalEngine, cardCode: string, id: string, ownerId: string): OracleCard {
  const card = original.raw.sz({
    entries: [{ name: cardCode, count: 1, cardCode }],
    ownerPlayerId: ownerId,
    source: "mainDeck",
    createdAt: BASE_TIME,
  })[0] as unknown as OracleCard;
  return { ...card, id, ownerPlayerId: ownerId, exhausted: false };
}

function findCard(cards: OracleCard[], code: string): OracleCard | undefined {
  return cards.find((card) => card.cardCode === code);
}

function injectFuzzState(original: OriginalEngine, room: OracleRoom): void {
  const p1 = room.players[0]!;
  const p2 = room.players[1]!;
  const b1 = p1.board!;
  const b2 = p2.board!;

  /* --- legends/helpers: Orianna, Ivern, Neeko + an additional legend ------------------- */
  b1.legend.push(setupCard(original, "RAD-145", "fuzz-orianna-legend", p1.id));
  b1.legend.push(setupCard(original, "UNL-195", "fuzz-ivern-legend", p1.id));
  b1.additionalLegends = [setupCard(original, "RAD-173S", "fuzz-additional-legend", p1.id)];

  /* --- base: Orianna gear, Dockside, Kharox, banish source, trash, hidden cards -------- */
  b1.base.push(setupCard(original, "OGN-077", "fuzz-ori-gear", p1.id));
  b1.base.push(setupCard(original, "OGN-058", "fuzz-ori-gear-2", p1.id));
  b1.base.push(setupCard(original, "RAD-150", "fuzz-equip-gear", p1.id));
  const kharox = setupCard(original, "VEN-114", "fuzz-kharox", p1.id);
  kharox.customLabels = ["Empowered"];
  b1.base.push(kharox);
  b1.base.push(setupCard(original, "RAD-150", "fuzz-banish-source", p1.id));
  b1.battlefieldA.push(setupCard(original, "RAD-136", "fuzz-dockside", p1.id));
  b1.trash.push(setupCard(original, "RAD-105", "fuzz-trash-1", p1.id));
  b1.trash.push(setupCard(original, "OGN-169", "fuzz-trash-2", p1.id));

  const hidden = setupCard(original, "RAD-107", "fuzz-hidden-unit", p1.id);
  hidden.hidden = true;
  hidden.exhausted = true;
  hidden.keywords = [...((hidden.keywords as string[] | undefined) ?? []), "Hidden"];
  b1.battlefieldB.push(hidden);

  /* --- Neeko in play, one extra unit for every actor --------------------------------- */
  const neeko = setupCard(original, "RAD-167", "fuzz-neeko", p1.id);
  neeko.type = "Unit";
  b1.base.push(neeko);

  /* --- key spells in hand: Time Warp, Repeat, Flow, plus a gear/unit ------------------ */
  const timeWarp =
    findCard([...b1.hand, ...b1.deck], "OGN-122") ?? setupCard(original, "OGN-122", "fuzz-timewarp", p1.id);
  const repeat = findCard([...b1.hand, ...b1.deck], "SFD-040") ?? setupCard(original, "SFD-040", "fuzz-repeat", p1.id);
  const flow = findCard([...b1.hand, ...b1.deck], "VEN-031") ?? setupCard(original, "VEN-031", "fuzz-flow", p1.id);
  for (const [card, from] of [
    [timeWarp, b1.deck],
    [repeat, b1.deck],
    [flow, b1.deck],
  ] as const) {
    const index = from.findIndex((candidate) => candidate.id === card.id);
    if (index >= 0) from.splice(index, 1);
    b1.hand.push(card);
  }
  for (const [code, id] of [
    ["RAD-105", "fuzz-hand-unit"],
    ["OGN-199", "fuzz-hand-unit-2"],
    ["OGN-077", "fuzz-hand-gear"],
  ] as const) {
    const card = findCard([...b1.hand, ...b1.deck], code);
    if (card) {
      const index = b1.deck.findIndex((candidate) => candidate.id === card.id);
      if (index >= 0) b1.deck.splice(index, 1);
      b1.hand.push(card);
    } else {
      b1.hand.push(setupCard(original, code, id, p1.id));
    }
  }

  /* --- Dockside target + conquer defender on a battlefield --------------------------- */
  const defender = setupCard(original, "OGN-199", "fuzz-defender-unit", p2.id);
  b2.battlefieldA.push(defender);
  const banishTarget = setupCard(original, "RAD-107", "fuzz-banish-target", p2.id);
  b2.battlefieldA.push(banishTarget);

  /* --- opponent trash unit for Kharox, linked banish for unlink ---------------------- */
  b2.trash.push(setupCard(original, "OGN-082", "fuzz-opp-trash-unit", p2.id));
  const linked = setupCard(original, "OGN-045", "fuzz-linked-banished", p2.id);
  linked.banishedByCardId = "fuzz-banish-source";
  b2.banished.push(linked);

  /* --- every other actor gets a couple of hand cards and a base unit ------------------ */
  for (const player of room.players.slice(1)) {
    const board = player.board!;
    if (board.hand.length < 2) {
      board.hand.push(setupCard(original, "RAD-105", `fuzz-extra-unit-${player.id}`, player.id));
    }
    if (board.base.length === 0) {
      board.base.push(setupCard(original, "OGN-199", `fuzz-extra-base-${player.id}`, player.id));
    }
  }
}

export function buildFuzzFixture(
  original: OriginalEngine,
  variant: FuzzVariant,
  decks: FixtureDecks = loadDecks(),
): Room {
  const count = variant === "duel" ? 2 : variant === "free_for_all_3" ? 3 : 4;
  const shuffle = original.loadModule<{ P: (cards: OracleCard[], options: { seedKey: string }) => OracleCard[] }>(78176).P;
  const players = Array.from({ length: count }, (_, index) => {
    const playerId = `p${index + 1}`;
    const deck = index % 2 === 0 ? decks.deckA : decks.deckB;
    const seed = deck.sections;
    const battlefield = seed.battlefields[index % seed.battlefields.length]!.name;
    const battlefieldCode = seed.battlefields[index % seed.battlefields.length]!.cardCode;
    return {
      id: playerId,
      seat: index,
      name: NAMES[index]!,
      joinedAt: BASE_TIME + index * 1000,
      decklistRaw: deck.raw,
      submittedDeck: { sections: seed, raw: deck.raw },
      selectedBattlefield: battlefield,
      selectedBattlefieldCardCode: battlefieldCode,
      board: boardFromDeck(original, seed, playerId, BASE_TIME + index * 1000),
    };
  });

  const room: OracleRoom = {
    roomCode: `FUZZ${count}`,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
    phase: "in_game",
    gameVariant: variant,
    roomMode: "multiplayer",
    playMode: "constructed",
    deckRulesMode: "standard",
    matchFormat: "bo1",
    setupOrderVersion: 2,
    firstPlayerId: "p1",
    firstPlayerChooserId: "p1",
    initiativeRound: 1,
    initiativeRolls: Object.fromEntries(players.map((player, index) => [player.id, index === 0 ? 17 : 9])),
    mulliganDonePlayerIds: players.map((player) => player.id),
    turnNumber: 1,
    playerTurnCounts: Object.fromEntries(players.map((player) => [player.id, 0])),
    players,
    log: [],
    chainEntries: [],
    chainResolveVotes: [],
    ...(variant === "teams_2v2"
      ? {
          teamIdByPlayerId: Object.fromEntries(
            players.map((player, index) => [player.id, index % 2 === 0 ? "team-1" : "team-2"]),
          ),
        }
      : {}),
  };

  // Shuffle both decks with the ORIGINAL seeded shuffle, then deal 4 opening cards.
  for (const player of room.players) {
    const board = player.board!;
    board.deck = shuffle(board.deck, { seedKey: `${SEED_KEY}|${player.id}|mainDeck` });
    board.runeDeck = shuffle(board.runeDeck, { seedKey: `${SEED_KEY}|${player.id}|runeDeck` });
    const drawn: OracleCard[] = [];
    for (let i = 0; i < 4 && board.deck.length > 0; i += 1) drawn.push(board.deck.pop()!);
    board.hand = drawn;
  }

  // ORIGINAL turn start (ready → hold → channel → draw → step=main; variant adjustments).
  const turnStart = original.loadModule<{
    k: (state: OracleRoom, index: number) => { nextRoom: OracleRoom } | null;
  }>(70094).k;
  const started = turnStart(room, 0);
  if (!started) throw new Error(`turn start failed for ${variant}`);
  const inGame = started.nextRoom;

  injectFuzzState(original, inGame);
  return inGame as unknown as Room;
}
