import type { Room } from "@rift/protocol";

import type { GameBoardLayoutHints } from "@/components/board/layout/GameBoardView";

import {
  CARDS,
  emptyBoard,
  fillerDeck,
  makeCard,
  makePlayer,
  makeRoom,
  rune,
} from "./common";

export const AUTOPAY_VIEWER_ID = "player-kai";
export const AUTOPAY_OPPONENT_ID = "player-ari";

const autopayHand = [
  makeCard({
    id: "autopay-hand-poro",
    name: "Poro Herder",
    source: "mainDeck",
    cardCode: "OGN-061",
    type: "Unit",
    domains: ["Calm"],
    energyCost: 3,
    might: 3,
    text: "When I enter, create a Recruit token.",
  }),
  CARDS.rebuke(),
  makeCard({
    id: "autopay-hand-viktor",
    name: "Viktor, Innovator",
    source: "mainDeck",
    cardCode: "OGN-117A",
    type: "Unit",
    domains: ["Mind"],
    energyCost: 4,
    might: 3,
    text: "When I enter, draw 1.",
  }),
  makeCard({
    id: "autopay-hand-treasure",
    name: "Treasure Hunter",
    source: "mainDeck",
    cardCode: "SFD-130",
    type: "Unit",
    domains: ["Chaos"],
    energyCost: 2,
    might: 1,
    text: "When I enter, draw 1.",
  }),
  makeCard({
    id: "autopay-hand-jhin",
    name: "Jhin, Murderous Artist",
    source: "mainDeck",
    cardCode: "UNL-022A",
    type: "Unit",
    domains: ["Fury"],
    energyCost: 4,
    might: 4,
    text: "When I attack, deal 1 to a unit here.",
  }),
  makeCard({
    id: "autopay-hand-skulker",
    name: "Shipyard Skulker",
    source: "mainDeck",
    cardCode: "OGN-175",
    type: "Unit",
    domains: ["Chaos"],
    energyCost: 3,
    might: 3,
    text: "When I enter, discard a card.",
  }),
];

const viewer = makePlayer({
  id: AUTOPAY_VIEWER_ID,
  seat: 0,
  name: "Kai",
  board: emptyBoard({
    score: 4,
    deck: fillerDeck("autopay-kai-deck", 32),
    hand: autopayHand,
    runeArea: [
      rune("Fury", 21),
      rune("Fury", 22),
      rune("Fury", 23),
      rune("Fury", 24),
      rune("Mind", 21, true),
    ],
    runeDeck: Array.from({ length: 7 }, (_, index) => rune("Fury", 200 + index)),
    legend: [CARDS.kaisa("autopay-self-legend")],
    battlefieldB: [CARDS.kaisa("autopay-self-unit")],
    base: [CARDS.recruitToken()],
  }),
});

const opponent = makePlayer({
  id: AUTOPAY_OPPONENT_ID,
  seat: 1,
  name: "Ari",
  board: emptyBoard({
    score: 2,
    deck: fillerDeck("autopay-ari-deck", 30),
    hand: Array.from({ length: 6 }, (_, index) =>
      makeCard({
        id: `autopay-ari-hand-${index}`,
        name: `Opponent card ${index + 1}`,
        source: "mainDeck",
        isPlaceholder: true,
      }),
    ),
    runeArea: [rune("Fury", 31), rune("Fury", 32), rune("Fury", 33), rune("Fury", 34), rune("Calm", 31)],
    runeDeck: Array.from({ length: 7 }, (_, index) => rune("Calm", 300 + index)),
    battlefieldA: [CARDS.blazingScorcher("autopay-bf-opponent-unit")],
    battlefieldB: [CARDS.hiddenUnit("autopay-hidden-unit")],
  }),
});

export const autopayRoom: Room = makeRoom({
  roomCode: "V3QBY",
  players: [viewer, opponent],
  firstPlayerId: AUTOPAY_VIEWER_ID,
  activeTurnPlayerId: AUTOPAY_VIEWER_ID,
  turnNumber: 5,
  log: [],
});

export const autopayHints: GameBoardLayoutHints = {
  boardLines: "default",
  showScoreTrack: true,
  showTurnControls: true,
  canEndTurn: true,
  canSwitchSeat: true,
  phase: "main",
  activeTurnSide: "self",
  handRevealed: true,
  autoPayPreviewCardIds: ["autopay-hand-treasure"],
  clocksByPlayerId: {
    [AUTOPAY_VIEWER_ID]: "18:56",
    [AUTOPAY_OPPONENT_ID]: "16:29",
  },
  battlefields: {
    own: { zone: "battlefieldA", name: "Monastery of Hirana", cardCode: "OGN-282" },
    opponent: { zone: "battlefieldB", name: "Grove of the God-Willow", cardCode: "OGN-280" },
  },
};
