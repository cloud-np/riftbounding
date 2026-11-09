/**
 * Trash pile presentation from a real strict room: a spell resolves and goes to its owner's
 * trash, then the board is rendered from each viewer's per-viewer redacted snapshot. Trash is a
 * public zone (R108/R109), so the top card face must render for the owner and for the opponent,
 * in strict and sandbox rooms alike.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Room } from "@rift/protocol";
import { redactRoomForViewer } from "@rift/sync";

import { BoardInteractionProvider } from "@/components/board/interaction";
import { GameBoardView } from "@/components/board/layout/GameBoardView";

import { scenario } from "../../../../../../../packages/rules/test/scenarios/dsl";

const noop = () => undefined;

interface TrashFixture {
  room: Room;
  cardId: string;
  cardCode: string;
}

/** Strict room: the bot seat is first, plays Concentrate and the spell resolves into its trash. */
function strictSpellInTrash(): TrashFixture {
  const s = scenario({
    firstPlayer: "p2",
    extraCards: { p2: ["Concentrate"] },
    p2: { hand: ["Concentrate"], energy: 5 },
  });
  s.as("p2").play("Concentrate").expectOk();
  s.as("p1").pass().expectOk();

  expect(s.room.rules?.chain).toHaveLength(0);
  const card = s.room.players.find((player) => player.id === "p2")?.board?.trash.at(-1);
  if (!card) throw new Error("Concentrate did not reach the bot's trash");

  // Match the live bot-room presentation: Cloud vs the server-driven Practice Bot.
  s.room.players[0]!.name = "Cloud";
  s.room.players[1]!.name = "Practice Bot";
  s.room.players[1]!.isBot = true;

  return { room: s.room, cardId: card.id, cardCode: card.cardCode ?? "" };
}

function viewerSnapshot(room: Room, viewerId: string): Room {
  return redactRoomForViewer(room, {
    playerId: viewerId,
    viewerRole: "player",
    controlledPlayerIds: [viewerId],
  });
}

function renderBoard(room: Room, viewerId: string): string {
  return renderToStaticMarkup(
    createElement(BoardInteractionProvider, {
      state: room,
      viewerId,
      controlledPlayerIds: [viewerId],
      dispatch: noop,
      mode: "multiplayer" as const,
      children: createElement(GameBoardView, {
        state: room,
        viewerId,
        layoutHints: {
          showScoreTrack: true,
          connectedPlayerIds: ["p1", "p2"],
          battlefields: {
            own: { zone: "battlefieldA", name: "Training Grounds" },
            opponent: { zone: "battlefieldB", name: "Mountain Pass" },
          },
        },
      }),
    }),
  );
}

function expectTrashTopCard(html: string, fixture: TrashFixture): void {
  expect(html).toContain('data-pile-top-card="trash"');
  expect(html).toContain(`data-card-id="${fixture.cardId}"`);
  expect(html).toContain(`data-card-code="${fixture.cardCode}"`);
  expect(html).toContain(`${fixture.cardCode}.webp`);
  expect(html).toContain(`small-v2/${fixture.cardCode}.webp`);
  expect(html).not.toContain("placeholder.svg");
}

describe("trash pile top card (public zone)", () => {
  it("shows the opponent's resolved strict spell face up from the other player's snapshot", () => {
    const fixture = strictSpellInTrash();
    const view = viewerSnapshot(fixture.room, "p1");
    const opponentTrash = view.players.find((player) => player.id === "p2")?.board?.trash;
    expect(opponentTrash?.map((card) => card.cardCode)).toContain(fixture.cardCode);

    expectTrashTopCard(renderBoard(view, "p1"), fixture);
  });

  it("shows the same card face up in the owner's own snapshot", () => {
    const fixture = strictSpellInTrash();
    expectTrashTopCard(renderBoard(viewerSnapshot(fixture.room, "p2"), "p2"), fixture);
  });

  it("shows a banished card face up from the other player's snapshot too", () => {
    const fixture = strictSpellInTrash();
    const board = fixture.room.players.find((player) => player.id === "p2")!.board!;
    const banished = board.trash.pop()!;
    board.banished.push(banished);

    const html = renderBoard(viewerSnapshot(fixture.room, "p1"), "p1");
    expect(html).toContain('data-pile-top-card="banished"');
    expect(html).toContain(`data-card-id="${fixture.cardId}"`);
    expect(html).toContain(`small-v2/${fixture.cardCode}.webp`);
  });

  it("renders the same public top card in a sandbox room (no strict-only branch)", () => {
    const fixture = strictSpellInTrash();
    const sandbox = structuredClone(fixture.room);
    sandbox.rulesMode = undefined;
    sandbox.rules = undefined;
    sandbox.chainEntries = [];

    const html = renderBoard(viewerSnapshot(sandbox, "p1"), "p1");
    expectTrashTopCard(html, fixture);
    expect(html).not.toContain('data-testid="strict-prompt-banner"');
  });
});
