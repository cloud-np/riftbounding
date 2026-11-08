import type { Room } from "@rift/protocol";

import type { GameBoardLayoutHints } from "@/components/board/layout/GameBoardView";

import { CARDS, emptyBoard, fillerDeck, makeCard, makeLog, makePlayer, makeRoom, rune } from "./common";

export const CONQUER_VIEWER_ID = "player-kai";
export const CONQUER_OPPONENT_ID = "player-ari";

const selfUnit = CARDS.kaisa("conquer-self-unit");
const enemyUnit = CARDS.blazingScorcher("conquer-enemy-unit");

const viewer = makePlayer({
  id: CONQUER_VIEWER_ID,
  seat: 0,
  name: "Kai",
  board: emptyBoard({
    score: 3,
    deck: fillerDeck("conquer-kai-deck", 34),
    hand: [CARDS.rebuke(), CARDS.jhin(), CARDS.fiora(), CARDS.treasureHunter()],
    runeArea: [rune("Fury", 41), rune("Fury", 42), rune("Fury", 43), rune("Mind", 41)],
    runeDeck: Array.from({ length: 8 }, (_, index) => rune("Fury", 400 + index)),
    legend: [CARDS.kaisa("conquer-self-legend")],
    battlefieldB: [selfUnit],
  }),
});

const opponent = makePlayer({
  id: CONQUER_OPPONENT_ID,
  seat: 1,
  name: "Ari",
  board: emptyBoard({
    score: 2,
    deck: fillerDeck("conquer-ari-deck", 31),
    hand: Array.from({ length: 5 }, (_, index) =>
      makeCard({
        id: `conquer-ari-hand-${index}`,
        name: `Opponent card ${index + 1}`,
        source: "mainDeck",
        isPlaceholder: true,
      }),
    ),
    runeArea: [rune("Fury", 51), rune("Fury", 52), rune("Fury", 53), rune("Calm", 51)],
    runeDeck: Array.from({ length: 8 }, (_, index) => rune("Calm", 500 + index)),
    battlefieldA: [enemyUnit],
  }),
});

export const conquerRoom: Room = makeRoom({
  roomCode: "V3QBY",
  players: [viewer, opponent],
  firstPlayerId: CONQUER_VIEWER_ID,
  activeTurnPlayerId: CONQUER_VIEWER_ID,
  turnNumber: 4,
  log: [
    makeLog("Attacked at Grove of the God-Willow with Kai'Sa, Survivor.", 4, 0),
    makeLog("Ari assigned no blockers.", 4, 1),
  ],
  extra: {
    pendingBattlefieldConquerAssist: {
      zone: "battlefieldB",
      attackerPlayerId: CONQUER_VIEWER_ID,
      defenderPlayerId: CONQUER_OPPONENT_ID,
      stage: "attacker_confirm_conquer",
      turnNumber: 4,
    },
  },
});

export const conquerHints: GameBoardLayoutHints = {
  boardLines: "default",
  showScoreTrack: true,
  showTurnControls: true,
  canEndTurn: false,
  canSwitchSeat: true,
  phase: "main",
  activeTurnSide: "self",
  handRevealed: true,
  selectedCardIds: [selfUnit.id],
  clocksByPlayerId: {
    [CONQUER_VIEWER_ID]: "04:18",
    [CONQUER_OPPONENT_ID]: "07:42",
  },
  battlefields: {
    own: { zone: "battlefieldA", name: "Monastery of Hirana", cardCode: "OGN-282" },
    opponent: { zone: "battlefieldB", name: "Grove of the God-Willow", cardCode: "OGN-280" },
  },
};
