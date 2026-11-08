/**
 * 466.2.d / 466.2.d.1 — the Combat Chain. `flushPendingTriggers` is an R2-effects stub in this
 * branch, so it is mocked to record the order R2-combat passes.
 */
import { describe, expect, it, vi } from "vitest";
import type { GameVariant } from "@rift/protocol";
import { runCleanup } from "../../../src";
import { scenario } from "../../scenarios/dsl";
import { placeUnit, setControl, table } from "./helpers";

const calls = vi.hoisted(() => [] as Array<{ order?: readonly string[] }>);

vi.mock("../../../src/triggers", () => ({
  flushPendingTriggers: (_room: unknown, _step: unknown, opts?: { order?: readonly string[] }) => {
    calls.push({ ...(opts?.order ? { order: [...opts.order] } : {}) });
    return 0;
  },
}));

describe("the Combat Chain [R466.2.d][R466.2.d.1]", () => {
  it("[R466.2.d.1] duel: the Attacker places triggers first, then the Defender", () => {
    calls.length = 0;
    const s = scenario({ battlefields: { p2: "Bandle Tree" } });
    placeUnit(s, "p2", "Stellacorn Herder", "battlefieldA");
    setControl(s.room, "battlefieldA", "p2");
    placeUnit(s, "p1", "Clockwork Keeper", "base");
    s.as("p1").move("Clockwork Keeper", "battlefieldA").expectOk();
    expect(calls).toEqual([{ order: ["p1", "p2"] }]);
  });

  it("[R466.2.d.1][R303.2.a] FFA4: Attacker, then the non-Defenders in Turn Order, then the Defender", () => {
    calls.length = 0;
    const t = table("free_for_all_4" as GameVariant);
    t.room.rules!.turn.player = "p1";
    t.place("p3", "Stellacorn Herder", "battlefieldB");
    t.place("p2", "Clockwork Keeper", "battlefieldB");
    setControl(t.room, "battlefieldB", "p2");
    t.room.rules!.contested.battlefieldB = "p3";
    runCleanup(t.room, t.step());
    expect(t.room.rules?.combat).toMatchObject({ attacker: "p3", defender: "p2" });
    expect(calls).toEqual([{ order: ["p3", "p1", "p4", "p2"] }]);
  });

  it("[R466.2.e] with no triggers the Combat Showdown continues Open", () => {
    calls.length = 0;
    const s = scenario({ battlefields: { p2: "Bandle Tree" } });
    placeUnit(s, "p2", "Stellacorn Herder", "battlefieldA");
    setControl(s.room, "battlefieldA", "p2");
    placeUnit(s, "p1", "Clockwork Keeper", "base");
    s.as("p1").move("Clockwork Keeper", "battlefieldA").expectOk();
    s.expectState("showdown_open").expectFocus("p1").expectPriority("p1");
    expect(s.room.rules?.chain).toEqual([]);
  });
});
