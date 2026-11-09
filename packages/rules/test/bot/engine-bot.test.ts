/**
 * The engine binding of the shared bot API (`pickStrictBotAction`).
 *
 * The rules package cannot import the engine, so this thin wrapper lives in `@rift/engine` and
 * binds `createEngineRulesHost`. These tests exercise it through the relative source import the
 * scenario DSL already uses.
 */
import { describe, expect, it } from "vitest";
import { pickStrictBotAction } from "../../../engine/src/index";
import { mulberry32 } from "../../src";
import { scenario } from "../scenarios/dsl";

describe("pickStrictBotAction", () => {
  it("returns a legal intent for the strict in-game actor", () => {
    const room = scenario().room;
    const intent = pickStrictBotAction(room, "p1", mulberry32(1));
    expect(intent).not.toBeNull();
    expect(intent?.type.startsWith("rules_")).toBe(true);
  });

  it("returns null outside strict mode, outside in_game and for a non-actor", () => {
    const sandbox = scenario().room;
    sandbox.rulesMode = "sandbox";
    delete sandbox.rules;
    expect(pickStrictBotAction(sandbox, "p1", mulberry32(1))).toBeNull();

    const lobby = scenario().room;
    lobby.phase = "lobby";
    expect(pickStrictBotAction(lobby, "p1", mulberry32(1))).toBeNull();

    const room = scenario().room;
    expect(pickStrictBotAction(room, "p2", mulberry32(1))).toBeNull();
  });

  it("is deterministic for the same seeded random stream", () => {
    const room = scenario().room;
    expect(pickStrictBotAction(room, "p1", mulberry32(42))).toEqual(
      pickStrictBotAction(room, "p1", mulberry32(42)),
    );
  });
});
