/**
 * R4 attachments: the board renders attached gear as the reference app's right-hand fan behind
 * its unit (the authoritative representation is same-zone + `attachedToCardId`). Sandbox equip
 * and the strict attach op both produce that shape and share this renderer.
 */
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CardInstance, Room } from "@rift/protocol";

import { AttachedCardFan, buildAttachedCardEvent } from "../../card/AttachedCardFan";
import { groupAttachedCards } from "../../card/attachments";
import type { CardEvent } from "../../card/types";

// The fan is invoked directly in the event-wiring test; keep the optional board context inert.
vi.mock("../../interaction/context", () => ({ useBoardInteractionOptional: () => null }));

import { BattlefieldLayer } from "../BattlefieldLayer";
import { BaseZone } from "../../zones/ZoneRails";
import {
  apply,
  inGame,
  makeContext,
  takeFromDeck,
} from "../../../../../../../packages/engine/test/strict-gestures-fixture";

function card(overrides: Partial<CardInstance> & { id: string; name: string }): CardInstance {
  return {
    source: "mainDeck",
    exhausted: false,
    createdAt: 0,
    ...overrides,
  };
}

const unit = card({ id: "unit-1", name: "Clockwork Keeper", cardCode: "OGN-038", type: "Unit" });
const gear = card({
  id: "gear-1",
  name: "Blade of the Exile",
  cardCode: "SFD-001",
  imageUrl: "/cards/SFD-001.webp",
  type: "Gear",
  attachedToCardId: unit.id,
});

describe("board attachment grouping", () => {
  it("takes attached cards out of the zone row and keys them to their host", () => {
    const groups = groupAttachedCards([unit, gear]);
    expect(groups.topLevel.map((entry) => entry.id)).toEqual([unit.id]);
    expect(groups.byHostId.get(unit.id)?.map((entry) => entry.id)).toEqual([gear.id]);
  });

  it("leaves an attachment top-level when its host is not in the same zone", () => {
    const groups = groupAttachedCards([gear]);
    expect(groups.topLevel.map((entry) => entry.id)).toEqual([gear.id]);
  });
});

describe("attached gear rendering", () => {
  it("draws the gear behind the unit instead of as a second row card", () => {
    const html = renderToStaticMarkup(
      createElement(BaseZone, { owner: "self", cards: [unit, gear] }),
    );
    expect(html).toContain(`data-attached-card-id="${gear.id}"`);
    expect(html).toContain("SFD-001.webp");
    expect(html.match(/data-board-card-visual="true"/gu)).toHaveLength(1);
  });

  it("renders a detached gear as its own board card", () => {
    const html = renderToStaticMarkup(
      createElement(BaseZone, { owner: "self", cards: [unit, { ...gear, attachedToCardId: undefined }] }),
    );
    expect(html).not.toContain("data-attached-card-id");
    expect(html.match(/data-board-card-visual="true"/gu)).toHaveLength(2);
  });
});

/* ---------------------------------------------------- real strict engine state */

function resolveChain(room: Room, ctx: ReturnType<typeof makeContext>): Room {
  for (let step = 0; step < 32 && room.rules?.chain.length; step += 1) {
    const actor = room.rules?.priority;
    if (!actor) break;
    room = apply(room, actor, { type: "rules_pass" }, ctx);
  }
  return room;
}

/** A real room where p1 equipped two copies of Blade of the Exile to Clockwork Keeper. */
function equippedRoom(mode: "strict" | "sandbox"): {
  room: Room;
  ctx: ReturnType<typeof makeContext>;
  unitId: string;
  gearIds: string[];
} {
  const ctx = makeContext();
  let room = inGame(mode, ctx);
  const board = room.players[0]!.board!;
  const unit = takeFromDeck(board, "Clockwork Keeper", "base");
  const blades = [
    takeFromDeck(board, "Blade of the Exile", "base"),
    takeFromDeck(board, "Blade of the Exile", "base"),
  ];
  for (const blade of blades) {
    room = resolveChain(
      apply(
        room,
        "p1",
        { type: "equip_card", equipmentCardId: blade.id, unitCardId: unit.id },
        ctx,
      ),
      ctx,
    );
  }
  return { room, ctx, unitId: unit.id, gearIds: blades.map((blade) => blade.id) };
}

function attachedIds(html: string): string[] {
  return [...html.matchAll(/data-attached-card-id="([^"]+)"/gu)].map((match) => match[1]!);
}

function attachmentTags(html: string): string[] {
  return [...html.matchAll(/<div[^>]*data-attached-card-id="[^"]+"[^>]*>/gu)].map(
    (match) => match[0],
  );
}

function renderBase(room: Room, owner: "self" | "opponent"): string {
  return renderToStaticMarkup(
    createElement(BaseZone, { owner, cards: room.players[0]!.board!.base }),
  );
}

describe("strict attached equipment fan", () => {
  it("renders a real unit's two attached Equipment in attach order for both players", () => {
    const { room, unitId, gearIds } = equippedRoom("strict");
    expect(gearIds).toHaveLength(2);
    expect(room.players[0]!.board!.base.map((card) => card.id)).toEqual([unitId, ...gearIds]);

    for (const owner of ["self", "opponent"] as const) {
      const html = renderBase(room, owner);
      expect(attachedIds(html)).toEqual(gearIds);
      expect(html.match(/data-board-card-visual="true"/gu)).toHaveLength(1);
      expect(html.match(/alt="Blade of the Exile"/gu)).toHaveLength(2);
      expect(html).toContain('data-attached-card-rank="0"');
      expect(html).toContain('data-attached-card-rank="1"');
      // First-attached gear is above later gear; the unit is above the whole fan.
      expect(html).toContain('data-attached-card-z="2"');
      expect(html).toContain('data-attached-card-z="1"');
      expect(html).toContain("z-index:3");
      // Quarter-card steps and a slot widened to fit both attached cards.
      expect(html).toContain("left:calc(var(--card-width) * 0.26)");
      expect(html).toContain("left:calc(var(--card-width) * 0.52)");
      expect(html).toContain("width:calc(var(--card-width) * 1.52)");
      expect(html).toContain("flex-basis:calc(var(--card-width) * 1.52)");
      // Gear strips are hoverable with their own card identity (full preview uses this event).
      expect(html.match(/data-attached-card-name="Blade of the Exile"/gu)).toHaveLength(2);
    }
  });

  it("keeps the same fan when the equipped unit moves to a battlefield", () => {
    const { room, ctx, unitId, gearIds } = equippedRoom("strict");
    const moved = resolveChain(
      apply(room, "p1", { type: "move_card", from: "base", to: "battlefieldA", cardId: unitId }, ctx),
      ctx,
    );
    expect(moved.players[0]!.board!.base).toEqual([]);
    expect(moved.players[0]!.board!.battlefieldA.map((card) => card.id)).toEqual([
      unitId,
      ...gearIds,
    ]);

    const html = renderToStaticMarkup(
      createElement(BattlefieldLayer, {
        room: moved,
        viewer: moved.players[0]!,
        opponents: [moved.players[1]!],
        battlefields: { own: { zone: "battlefieldA", name: "Altar to Unity" } },
      }),
    );
    expect(attachedIds(html)).toEqual(gearIds);
    expect(html).toContain("data-attached-card-fan=\"true\"");
    expect(html.match(/data-board-card-visual="true"/gu)).toHaveLength(1);
    expect(html).toContain("left:calc(var(--card-width) * 0.52)");
  });

  it("sandbox renders through the exact same shared fan", () => {
    const strict = equippedRoom("strict");
    const sandbox = equippedRoom("sandbox");
    const strictHtml = renderBase(strict.room, "self");
    const sandboxHtml = renderBase(sandbox.room, "self");

    expect(attachedIds(sandboxHtml)).toEqual(sandbox.gearIds);
    expect(attachedIds(sandboxHtml)).toEqual(attachedIds(strictHtml));
    expect(attachmentTags(sandboxHtml)).toEqual(attachmentTags(strictHtml));
  });
});

function findAttachedNode(node: ReactNode, cardId: string): ReactElement | null {
  for (const child of Children.toArray(node)) {
    if (!isValidElement(child)) continue;
    const props = child.props as Record<string, unknown>;
    if (props["data-attached-card-id"] === cardId) return child;
    const found = findAttachedNode(props.children as ReactNode, cardId);
    if (found) return found;
  }
  return null;
}

describe("attached gear hover events", () => {
  it("routes pointer enter/leave on a gear strip to the normal card hover events", () => {
    const events: CardEvent[] = [];
    const fan = AttachedCardFan({
      cards: [gear],
      zone: "base",
      owner: "self",
      onCardEvent: (event) => events.push(event),
    });
    const node = findAttachedNode(fan, gear.id);
    expect(node).not.toBeNull();
    const rect = { left: 4, top: 8, right: 24, bottom: 38, width: 20, height: 30 };
    const pointer = {
      pointerType: "mouse",
      currentTarget: { getBoundingClientRect: () => rect },
    };
    (node!.props as { onPointerEnter: (event: unknown) => void }).onPointerEnter(pointer);
    (node!.props as { onPointerLeave: (event: unknown) => void }).onPointerLeave(pointer);

    expect(events.map((event) => event.type)).toEqual(["hover", "hoverEnd"]);
    expect(events[0]).toMatchObject({
      card: gear,
      zone: "base",
      owner: "self",
      anchorRect: rect,
    });
  });

  it("builds a normal board hover event for the gear under the pointer", () => {
    const gearCard = card({
      id: "gear-hover",
      name: "Blade of the Exile",
      cardCode: "RAD-150",
      type: "Gear",
      attachedToCardId: unit.id,
    });
    const event = buildAttachedCardEvent({
      type: "hover",
      card: gearCard,
      zone: "base",
      owner: "opponent",
      anchorRect: { left: 10, top: 20, right: 30, bottom: 50, width: 20, height: 30 },
    });
    expect(event).toMatchObject({
      type: "hover",
      card: gearCard,
      zone: "base",
      owner: "opponent",
      exhausted: false,
      faceDown: false,
      anchorRect: { left: 10, top: 20, right: 30, bottom: 50, width: 20, height: 30 },
    });
  });
});
