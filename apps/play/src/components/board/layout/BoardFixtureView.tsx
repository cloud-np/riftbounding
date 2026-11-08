"use client";

import { getBoardFixture } from "@/fixtures";
import { GameBoardView } from "./GameBoardView";

export function BoardFixtureView({
  fixtureId,
  padded = true,
}: {
  fixtureId?: string | null;
  padded?: boolean;
}) {
  const fixture = getBoardFixture(fixtureId);
  return (
    <div
      className="sim-game-viewport"
      data-padded={padded ? "true" : "false"}
      style={{ height: "100dvh" }}
      data-board-fixture={fixture.id}
    >
      <GameBoardView
        state={fixture.room}
        viewerId={fixture.viewerId}
        layoutHints={fixture.hints}
        className="min-h-0"
      />
    </div>
  );
}
