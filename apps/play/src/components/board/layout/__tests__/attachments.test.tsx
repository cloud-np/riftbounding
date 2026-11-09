/**
 * R4 attachments: the board renders an attached gear tucked behind its unit (the authoritative
 * representation is same-zone + `attachedToCardId`). Sandbox equip and the strict attach op both
 * produce that shape.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CardInstance } from "@rift/protocol";

import { groupAttachedCards } from "../../card/attachments";
import { BaseZone } from "../../zones/ZoneRails";

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
