/**
 * R4 strict attachments: the attach op must leave the same board representation the sandbox
 * `equip_card` handler produces (same zone list, gear directly behind the unit, link set), so
 * the board renders, moves and detaches it identically in both modes.
 */
import { describe, expect, it } from "vitest";

import type { Room } from "@rift/protocol";

import { createEngineRulesHost } from "../src/strict/host";
import {
  apply,
  inGame,
  makeContext,
  takeFromDeck,
} from "./strict-gestures-fixture";

interface AttachmentFixture {
  room: Room;
  ctx: ReturnType<typeof makeContext>;
  keeperId: string;
  bladeId: string;
}

/** Base holds exactly [Blade, Keeper] so the sandbox equip has to move the gear behind the unit. */
function attachmentFixture(rulesMode: "strict" | "sandbox"): AttachmentFixture {
  const ctx = makeContext();
  const room = inGame(rulesMode, ctx);
  const board = room.players[0]!.board!;
  const keeper = takeFromDeck(board, "Clockwork Keeper", "base");
  const blade = takeFromDeck(board, "Blade of the Exile", "base");
  board.base = [blade, keeper];
  return { room, ctx, keeperId: keeper.id, bladeId: blade.id };
}

function resolveChain(room: Room, ctx: ReturnType<typeof makeContext>): Room {
  for (let step = 0; step < 16 && room.rules?.chain.length; step += 1) {
    const actor = room.rules?.priority;
    if (!actor) break;
    room = apply(room, actor, { type: "rules_pass" }, ctx);
  }
  return room;
}

function baseNames(room: Room): string[] {
  return (room.players[0]?.board?.base ?? []).map((card) => card.name);
}

describe("strict attach board representation [R435.4][R818.1.c.2]", () => {
  it("equips to the sandbox representation: same zone, directly behind the unit", () => {
    const sandbox = attachmentFixture("sandbox");
    const linked = apply(
      sandbox.room,
      "p1",
      { type: "equip_card", equipmentCardId: sandbox.bladeId, unitCardId: sandbox.keeperId },
      sandbox.ctx,
    );

    const strict = attachmentFixture("strict");
    const strictEquipped = resolveChain(
      apply(
        strict.room,
        "p1",
        { type: "equip_card", equipmentCardId: strict.bladeId, unitCardId: strict.keeperId },
        strict.ctx,
      ),
      strict.ctx,
    );

    expect(baseNames(linked)).toEqual(["Clockwork Keeper", "Blade of the Exile"]);
    expect(baseNames(strictEquipped)).toEqual(baseNames(linked));
    expect(
      strictEquipped.players[0]?.board?.base.find((card) => card.id === strict.bladeId)
        ?.attachedToCardId,
    ).toBe(strict.keeperId);
  });

  it("moves the attached gear with its unit exactly like the sandbox [R719.1]", () => {
    const sandbox = attachmentFixture("sandbox");
    let sandboxRoom = apply(
      sandbox.room,
      "p1",
      { type: "equip_card", equipmentCardId: sandbox.bladeId, unitCardId: sandbox.keeperId },
      sandbox.ctx,
    );
    sandboxRoom = apply(
      sandboxRoom,
      "p1",
      { type: "move_card", from: "base", to: "battlefieldA", cardId: sandbox.keeperId },
      sandbox.ctx,
    );

    const strict = attachmentFixture("strict");
    let strictRoom = resolveChain(
      apply(
        strict.room,
        "p1",
        { type: "equip_card", equipmentCardId: strict.bladeId, unitCardId: strict.keeperId },
        strict.ctx,
      ),
      strict.ctx,
    );
    strictRoom = apply(
      strictRoom,
      "p1",
      { type: "move_card", from: "base", to: "battlefieldA", cardId: strict.keeperId },
      strict.ctx,
    );

    const zoneNames = (room: Room) =>
      (room.players[0]?.board?.battlefieldA ?? []).map((card) => card.name);
    expect(zoneNames(strictRoom)).toEqual(zoneNames(sandboxRoom));
    expect(strictRoom.players[0]?.board?.base).toEqual([]);
    expect(
      strictRoom.players[0]?.board?.battlefieldA.find((card) => card.id === strict.bladeId)
        ?.attachedToCardId,
    ).toBe(strict.keeperId);
  });

  it("detach leaves the gear in its location (sandbox representation) [R436.4]", () => {
    const strict = attachmentFixture("strict");
    let room = resolveChain(
      apply(
        strict.room,
        "p1",
        { type: "equip_card", equipmentCardId: strict.bladeId, unitCardId: strict.keeperId },
        strict.ctx,
      ),
      strict.ctx,
    );
    const host = createEngineRulesHost(strict.ctx);
    expect(host.detach(room, strict.bladeId)).toBe(true);
    const base = room.players[0]!.board!.base;
    expect(base.map((card) => card.name)).toEqual(["Clockwork Keeper", "Blade of the Exile"]);
    expect(base.find((card) => card.id === strict.bladeId)?.attachedToCardId).toBeUndefined();
  });
});
