/**
 * Strict Hidden board UX (811.1.b/811.6) from a real engine room:
 * hide pockets only on legal battlefields, hide gesture state, opponent card back, next-turn
 * facedown play highlight, rejection reason, sandbox fallback.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { strictHiddenCards, strictLegalIntents, applyGameAction } from "@rift/engine";
import type { Room } from "@rift/protocol";
import { redactRoomForViewer } from "@rift/sync";

import { BoardInteractionProvider } from "@/components/board/interaction";
import { BoardInteractionContext } from "@/components/board/interaction/context";
import type {
  BoardInteractionValue,
  DropZoneHandlers,
} from "@/components/board/interaction/types";
import { GameBoardView } from "@/components/board/layout/GameBoardView";
import { BattlefieldLayer } from "@/components/board/layout/BattlefieldLayer";
import { ChainSlot } from "@/components/board/chain";
import { hideDropZones, strictViewFromLegal } from "../strict-interaction";
import {
  addSyntheticCard,
  apply,
  EVELYNN_ENTRANCING,
  makeContext,
  sandboxInGame,
  strictGestureRoom,
} from "../../../../../../../packages/engine/test/strict-gestures-fixture";

const noop = () => undefined;

function slotProps(room: Room, viewerId: string) {
  return {
    state: room,
    viewerId,
    controlledPlayerIds: [viewerId],
    dispatch: noop,
    mode: "multiplayer" as const,
  };
}

function renderBoard(room: Room, viewerId: string): string {
  const props = slotProps(room, viewerId);
  return renderToStaticMarkup(
    createElement(BoardInteractionProvider, {
      ...props,
      children: createElement(GameBoardView, {
        state: room,
        viewerId,
        layoutHints: {
          showScoreTrack: true,
          connectedPlayerIds: ["p1", "p2"],
          battlefields: {
            own: { zone: "battlefieldA", name: "Altar to Unity" },
            opponent: { zone: "battlefieldB", name: "Bandle Tree" },
          },
        },
        slots: { chain: createElement(ChainSlot, { ...props, embedded: true }) },
      }),
    }),
  );
}

const EMPTY_DROP_HANDLERS: DropZoneHandlers = {
  onDragEnter: noop,
  onDragOver: noop,
  onDragLeave: noop,
  onDrop: noop,
  onContextMenu: noop,
};

function renderPockets(room: Room, draggedCardId: string): string {
  const legal = strictLegalIntents(room, "p1")!;
  const viewer = room.players[0]!;
  const opponent = room.players[1]!;
  const value = {
    slotProps: slotProps(room, "p1"),
    strictView: strictViewFromLegal("p1", legal),
    drag: {
      active: true,
      kind: "boardCard",
      sourceZone: "hand",
      sourceOwner: "self",
      sourceCardId: draggedCardId,
      overZone: null,
      overOwner: null,
      toIndex: null,
    },
    armedAction: { kind: "none" },
    canAct: false,
    strictPromptOptionIds: new Set<string>(),
    strictPromptHoverId: null,
    getDropZoneHandlers: () => EMPTY_DROP_HANDLERS,
    getHideDropZoneHandlers: () => EMPTY_DROP_HANDLERS,
  } as unknown as BoardInteractionValue;
  return renderToStaticMarkup(
    createElement(
      BoardInteractionContext.Provider,
      { value },
      createElement(BattlefieldLayer, {
        room,
        viewer,
        opponents: [opponent],
        battlefields: {
          own: { zone: "battlefieldA", name: "Altar to Unity" },
          opponent: { zone: "battlefieldB", name: "Bandle Tree" },
        },
      }),
    ),
  );
}

function hiddenRoom(): {
  room: Room;
  ctx: ReturnType<typeof makeContext>;
  cardId: string;
  zone: string;
  locations: string[];
} {
  const fixture = strictGestureRoom();
  const card = addSyntheticCard(fixture.room, "p1", EVELYNN_ENTRANCING, "hand");
  const legal = strictLegalIntents(fixture.room, "p1")!;
  const locations = legal.hideable?.find((entry) => entry.cardId === card.id)?.locations ?? [];
  if (locations.length === 0) throw new Error("fixture has no legal Hide location");
  const zone = locations.includes("battlefieldA") ? "battlefieldA" : locations[0]!;
  const room = apply(
    fixture.room,
    "p1",
    { type: "move_card", from: "hand", to: zone, cardId: card.id, asHidden: true },
    fixture.ctx,
  );
  return { room, ctx: fixture.ctx, cardId: card.id, zone, locations };
}

describe("strict Hidden board UX [R811.1.b][R811.6]", () => {
  it("shows drop pockets only at the real legal Hide battlefields", () => {
    const fixture = strictGestureRoom();
    const card = addSyntheticCard(fixture.room, "p1", EVELYNN_ENTRANCING, "hand");
    const legal = strictLegalIntents(fixture.room, "p1")!;
    const entry = legal.hideable!.find((candidate) => candidate.cardId === card.id)!;
    expect(hideDropZones(legal.hideable, card.id)).toEqual(new Set(entry.locations));
    expect(hideDropZones(legal.hideable, fixture.ids.keeperHand)).toEqual(new Set());

    const html = renderPockets(fixture.room, card.id);
    for (const location of entry.locations) {
      expect(html).toContain(`data-hide-zone="${location}"`);
    }
    const renderedZones = ["battlefieldA", "battlefieldB"];
    for (const zone of renderedZones.filter((value) => !entry.locations.includes(value))) {
      expect(html).not.toContain(`data-hide-zone="${zone}"`);
    }
    expect(html).toContain("Hide (facedown)");
    expect(html).toContain("Cost: [A]");
    expect(html).not.toContain(`data-hide-zone="${fixture.ids.keeperHand}"`);
  });

  it("the Hide gesture puts the card facedown and hides its identity from the opponent", () => {
    const { room, cardId, zone } = hiddenRoom();
    const placed = room.players[0]?.board?.[zone as "battlefieldA"]?.find((card) => card.id === cardId);
    expect(placed?.hidden).toBe(true);
    expect(room.rules?.objects[cardId]?.hiddenTurn).toBe(room.rules?.turn.number);
    const opponent = redactRoomForViewer(room, {
      playerId: "p2",
      viewerRole: "player",
      controlledPlayerIds: ["p2"],
    });
    expect(JSON.stringify(opponent)).not.toContain("Evelynn");
    expect(JSON.stringify(opponent)).not.toContain(cardId);
    const html = renderBoard(opponent, "p2");
    expect(html).not.toContain("Evelynn");
    expect(html).not.toContain(cardId);
    expect(html).toContain('data-rift-image-kind="card-back"');
  });

  it("next turn highlights the facedown card and clicking it plays it", () => {
    const { room, ctx, cardId, zone } = hiddenRoom();
    let next = apply(room, "p1", { type: "end_turn" }, ctx);
    next = apply(next, "p2", { type: "end_turn" }, ctx);
    const legal = strictLegalIntents(next, "p1")!;
    expect(
      legal.playable?.some((entry) => entry.cardId === cardId && entry.fromFacedown),
    ).toBe(true);
    expect(strictHiddenCards(next, "p1").find((card) => card.cardId === cardId)?.playableNow).toBe(
      true,
    );
    const html = renderBoard(next, "p1");
    expect(html).toContain(`data-card-id="${cardId}"`);
    expect(html).toMatch(/(?<!\[)data-strict-playable="true"/u);

    const played = apply(
      next,
      "p1",
      { type: "toggle_exhausted", zone: zone as "battlefieldA", cardId, expectedExhausted: false },
      ctx,
    );
    expect(played.players[0]?.board?.[zone as "battlefieldA"]?.find((card) => card.id === cardId)?.hidden).not.toBe(
      true,
    );
  });

  it("same-turn play is rejected with the 420.1.a rule (toast reason)", () => {
    const { room, cardId, zone } = hiddenRoom();
    const legal = strictLegalIntents(room, "p1")!;
    expect(legal.playable?.some((entry) => entry.cardId === cardId)).not.toBe(true);
    const rejected = applyGameAction(
      room,
      "p1",
      { type: "toggle_exhausted", zone: zone as "battlefieldA", cardId, expectedExhausted: false },
      makeContext(),
    );
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.errorCode).toBe("not_in_hand");
      expect(rejected.rule).toBe("420.1.a");
    }
  });

  it("sandbox rooms keep the sandbox hide handler", () => {
    const ctx = makeContext();
    const room = sandboxInGame(ctx);
    const card = addSyntheticCard(room, "p1", EVELYNN_ENTRANCING, "hand");
    const hidden = apply(
      room,
      "p1",
      { type: "move_card", from: "hand", to: "battlefieldA", cardId: card.id, asHidden: true },
      ctx,
    );
    expect(hidden.rules).toBeUndefined();
    expect(hidden.players[0]?.board?.battlefieldA.find((entry) => entry.id === card.id)?.hidden).toBe(
      true,
    );
  });
});
