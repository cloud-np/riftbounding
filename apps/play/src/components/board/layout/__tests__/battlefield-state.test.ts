import { describe, expect, it } from "vitest";
import type { CardInstance, Room, RoomPlayer } from "@rift/protocol";

import { battlefieldState } from "../battlefield-state";

const unit = (id: string): CardInstance =>
  ({ id, name: id, source: "mainDeck", exhausted: false, createdAt: 0, type: "Unit" }) as CardInstance;
const room = (rules?: unknown) => ({ rules }) as unknown as Room;
const viewer = { id: "me" } as RoomPlayer;
const base = { viewer, zone: "battlefieldA" };

describe("battlefieldState", () => {
  it("is neutral when nobody holds the battlefield", () => {
    expect(battlefieldState({ ...base, room: room(), ownCards: [], opponentCards: [] })).toBe("neutral");
  });
  it("reports who controls it", () => {
    expect(battlefieldState({ ...base, room: room(), ownCards: [unit("a")], opponentCards: [] })).toBe("self");
    expect(battlefieldState({ ...base, room: room(), ownCards: [], opponentCards: [unit("b")] })).toBe("opponent");
  });
  it("is contested when both sides have units", () => {
    expect(
      battlefieldState({ ...base, room: room(), ownCards: [unit("a")], opponentCards: [unit("b")] }),
    ).toBe("contested");
  });
  it("is contested during a strict showdown or combat on the zone", () => {
    const showdown = room({ showdown: { battlefield: "battlefieldA" } });
    expect(battlefieldState({ ...base, room: showdown, ownCards: [unit("a")], opponentCards: [] })).toBe("contested");
    const combat = room({ combat: { battlefield: "battlefieldA" } });
    expect(battlefieldState({ ...base, room: combat, ownCards: [], opponentCards: [] })).toBe("contested");
    const other = room({ showdown: { battlefield: "battlefieldB" } });
    expect(battlefieldState({ ...base, room: other, ownCards: [], opponentCards: [] })).toBe("neutral");
  });
});
