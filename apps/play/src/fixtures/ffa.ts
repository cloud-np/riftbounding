import type { Room } from "@rift/protocol";

import type { GameBoardLayoutHints } from "@/components/board/layout/GameBoardView";

import { CARDS, emptyBoard, fillerDeck, makeCard, makePlayer, makeRoom, rune } from "./common";

export const FFA_VIEWER_ID = "ffa-kai";

function opponent(index: number, name: string, score: number) {
  return makePlayer({
    id: `ffa-${index}`,
    seat: index,
    name,
    board: emptyBoard({
      score,
      deck: fillerDeck(`ffa-deck-${index}`, 30 - index),
      hand: Array.from({ length: 4 + index }, (_, cardIndex) =>
        makeCard({
          id: `ffa-${index}-hand-${cardIndex}`,
          name: `Opponent ${name} card ${cardIndex + 1}`,
          source: "mainDeck",
          isPlaceholder: true,
        }),
      ),
      runeArea: [rune("Fury", 60 + index), rune("Fury", 70 + index), rune("Calm", 80 + index)],
      runeDeck: Array.from({ length: 8 }, (_, runeIndex) => rune("Calm", 600 + index * 10 + runeIndex)),
      battlefieldA: index === 0 ? [CARDS.blazingScorcher(`ffa-bf-a-${index}`)] : [],
      battlefieldB: index === 1 ? [CARDS.hiddenUnit(`ffa-bf-b-${index}`)] : [],
      battlefieldC: index === 2 ? [CARDS.kaisa(`ffa-bf-c-${index}`)] : [],
    }),
  });
}

const viewer = makePlayer({
  id: FFA_VIEWER_ID,
  seat: 0,
  name: "Kai",
  board: emptyBoard({
    score: 3,
    deck: fillerDeck("ffa-kai-deck", 32),
    hand: [CARDS.rebuke(), CARDS.jhin(), CARDS.poroHerder(), CARDS.treasureHunter()],
    runeArea: [rune("Fury", 71), rune("Fury", 72), rune("Fury", 73), rune("Mind", 71)],
    runeDeck: Array.from({ length: 8 }, (_, index) => rune("Fury", 700 + index)),
    legend: [CARDS.kaisa("ffa-kai-legend")],
    battlefieldB: [CARDS.kaisa("ffa-kai-bf")],
  }),
});

export const ffaRoom: Room = makeRoom({
  roomCode: "M4GMA",
  players: [viewer, opponent(1, "Ari", 2), opponent(2, "Nyx", 1), opponent(3, "Rho", 0)],
  firstPlayerId: FFA_VIEWER_ID,
  activeTurnPlayerId: FFA_VIEWER_ID,
  turnNumber: 3,
  variant: "free_for_all_4",
  log: [],
  extra: {
    sharedBattlefieldToken: {
      kind: "baron_pit",
      zone: "battlefieldToken",
      title: "Baron Pit",
      active: true,
    },
  },
});

export const ffaHints: GameBoardLayoutHints = {
  boardLines: "default",
  showScoreTrack: true,
  showTurnControls: true,
  canEndTurn: true,
  canSwitchSeat: true,
  phase: "main",
  activeTurnSide: "self",
  handRevealed: false,
  clocksByPlayerId: {
    [FFA_VIEWER_ID]: "12:04",
    "ffa-1": "11:28",
    "ffa-2": "10:56",
    "ffa-3": "09:12",
  },
  battlefields: {
    own: { zone: "battlefieldA", name: "Monastery of Hirana", cardCode: "OGN-282" },
    opponent: { zone: "battlefieldB", name: "Grove of the God-Willow", cardCode: "OGN-280" },
    supplemental: { zone: "battlefieldC", name: "Aspirant's Climb", cardCode: "OGN-276" },
  },
};
