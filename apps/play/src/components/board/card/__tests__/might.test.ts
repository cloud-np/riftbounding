import { describe, expect, it } from "vitest";

import type { CardInstance, Room } from "@rift/protocol";

import { unitMightView } from "../might";

function unit(over: Partial<CardInstance> = {}): CardInstance {
  return { id: "u1", name: "Sand Soldier", type: "Unit", might: 2, source: "mainDeck", ...over } as CardInstance;
}

describe("unitMightView", () => {
  it("sandbox: printed + buffs, damage from the rules object", () => {
    const room = { rules: { objects: { u1: { buffs: 1, damage: 2 } } } } as unknown as Room;
    const view = unitMightView(room, unit());
    expect(view.current).toBe(3);
    expect(view.damage).toBe(2);
    expect(view.state).toBe("damaged");
    expect(view.trend).toBe("up");
  });

  it("buffed / debuffed / plain", () => {
    const up = unitMightView(null, unit({ temporaryMightBuff: 2 }));
    expect(up).toMatchObject({ current: 4, state: "buffed" });
    const none = unitMightView(undefined, unit());
    expect(none).toMatchObject({ current: 2, state: null, trend: null });
  });

  it("never throws on partial or hidden objects", () => {
    expect(() => unitMightView({ rulesMode: "strict", phase: "in_game", rules: {} } as unknown as Room, unit())).not.toThrow();
    expect(() => unitMightView(null, { id: "x" } as unknown as CardInstance)).not.toThrow();
  });
});
