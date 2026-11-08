import type { Room } from "@rift/protocol";

import type { GameBoardLayoutHints } from "@/components/board/layout/GameBoardView";

import { autopayHints, autopayRoom, AUTOPAY_VIEWER_ID } from "./autopay";
import { conquerHints, conquerRoom, CONQUER_VIEWER_ID } from "./conquer";
import { ffaHints, ffaRoom, FFA_VIEWER_ID } from "./ffa";
import { heroHints, heroRoom, HERO_VIEWER_ID } from "./hero";

export interface BoardFixture {
  id: string;
  label: string;
  room: Room;
  viewerId: string;
  hints: GameBoardLayoutHints;
}

export const boardFixtures: BoardFixture[] = [
  {
    id: "hero",
    label: "Hero board (turn 5)",
    room: heroRoom,
    viewerId: HERO_VIEWER_ID,
    hints: heroHints,
  },
  {
    id: "autopay",
    label: "Auto-pay preview",
    room: autopayRoom,
    viewerId: AUTOPAY_VIEWER_ID,
    hints: autopayHints,
  },
  {
    id: "conquer",
    label: "Conquer prompt",
    room: conquerRoom,
    viewerId: CONQUER_VIEWER_ID,
    hints: conquerHints,
  },
  {
    id: "ffa",
    label: "FFA compact rails",
    room: ffaRoom,
    viewerId: FFA_VIEWER_ID,
    hints: ffaHints,
  },
  {
    id: "mobile",
    label: "Mobile / narrow board",
    room: heroRoom,
    viewerId: HERO_VIEWER_ID,
    hints: { ...heroHints, showSidebarSlot: false },
  },
];

export function getBoardFixture(id: string | undefined | null): BoardFixture {
  return boardFixtures.find((fixture) => fixture.id === id) ?? boardFixtures[0]!;
}

export { heroRoom, heroHints, HERO_VIEWER_ID } from "./hero";
export { autopayRoom, autopayHints, AUTOPAY_VIEWER_ID } from "./autopay";
export { conquerRoom, conquerHints, CONQUER_VIEWER_ID } from "./conquer";
