import type { Room } from "@rift/protocol";

import type { GameBoardLayoutHints } from "@/components/board/layout/GameBoardView";

import {
  CARDS,
  emptyBoard,
  fillerDeck,
  heroLog,
  makeCard,
  makePlayer,
  makeRoom,
  rune,
} from "./common";

export const HERO_VIEWER_ID = "player-kai";
export const HERO_OPPONENT_ID = "player-ari";

const hand = [
  CARDS.rebuke(),
  CARDS.jhin(),
  CARDS.poroHerder(),
  CARDS.treasureHunter(),
  CARDS.fiora(),
];

const selfUnit = CARDS.kaisa("hero-self-kaisa-bf");

const viewer = makePlayer({
  id: HERO_VIEWER_ID,
  seat: 0,
  name: "Kai",
  board: emptyBoard({
    score: 4,
    deck: fillerDeck("kai-deck", 32),
    hand,
    runeArea: [rune("Fury", 1), rune("Fury", 2), rune("Fury", 3), rune("Fury", 4), rune("Mind", 1)],
    runeDeck: Array.from({ length: 10 }, (_, index) => rune("Fury", 100 + index)),
    base: [CARDS.recruitToken()],
    legend: [CARDS.kaisa("hero-self-legend")],
    battlefieldB: [selfUnit],
  }),
});

const opponentHand = Array.from({ length: 7 }, (_, index) =>
  makeCard({
    id: `ari-hand-${index}`,
    name: `Opponent card ${index + 1}`,
    source: "mainDeck",
    isPlaceholder: true,
  }),
);

const opponent = makePlayer({
  id: HERO_OPPONENT_ID,
  seat: 1,
  name: "Ari",
  board: emptyBoard({
    score: 0,
    deck: fillerDeck("ari-deck", 33),
    hand: opponentHand,
    runeArea: [rune("Fury", 11), rune("Fury", 12), rune("Fury", 13), rune("Fury", 14), rune("Calm", 1)],
    runeDeck: Array.from({ length: 7 }, (_, index) => rune("Calm", 100 + index)),
    battlefieldA: [CARDS.blazingScorcher()],
    battlefieldB: [CARDS.hiddenUnit()],
  }),
});

export const heroRoom: Room = makeRoom({
  roomCode: "V3QBY",
  players: [viewer, opponent],
  firstPlayerId: HERO_VIEWER_ID,
  activeTurnPlayerId: HERO_VIEWER_ID,
  turnNumber: 5,
  log: heroLog(),
});

export const heroHints: GameBoardLayoutHints = {
  boardLines: "default",
  showScoreTrack: true,
  showTurnControls: true,
  canEndTurn: true,
  canSwitchSeat: true,
  phase: "main",
  activeTurnSide: "self",
  handRevealed: true,
  clocksByPlayerId: {
    [HERO_VIEWER_ID]: "18:56",
    [HERO_OPPONENT_ID]: "16:29",
  },
  battlefields: {
    own: { zone: "battlefieldA", name: "Monastery of Hirana", cardCode: "OGN-282" },
    opponent: { zone: "battlefieldB", name: "Grove of the God-Willow", cardCode: "OGN-280" },
  },
};

export { selfUnit as heroSelfBattlefieldUnit };
