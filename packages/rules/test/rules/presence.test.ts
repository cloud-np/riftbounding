/**
 * 107.3 — a facedown card in a battlefield's Facedown Zone is not a Unit present there.
 */
import { describe, expect, it } from "vitest";
import { hasUnitPresentAt, playersPresentAt, unitsPresentAt } from "../../src";
import { scenario } from "../scenarios/dsl";
import { passUntilSettled, placeUnit, setControl } from "./combat/helpers";

describe("units present at a location [R107.3]", () => {
  it("[R107.3] the presence helpers skip a facedown card the host's unitsAt still lists", () => {
    const s = scenario();
    const facedown = placeUnit(s, "p2", "Caitlyn, Patrolling", "battlefieldA", "facedown");
    facedown.hidden = true;
    const visible = placeUnit(s, "p1", "Stellacorn Herder", "battlefieldA", "visible");
    expect(s.host.unitsAt(s.room, "battlefieldA").map((card) => card.id)).toEqual(["visible", "facedown"]);
    expect(unitsPresentAt(s.room, s.host, "battlefieldA").map((card) => card.id)).toEqual([visible.id]);
    expect(hasUnitPresentAt(s.room, s.host, "p2", "battlefieldA")).toBe(false);
    expect(playersPresentAt(s.room, s.host, "battlefieldA")).toEqual(["p1"]);
  });

  it("[R107.3][R462][R463] a facedown card of the controller does not make a Combat: the mover conquers", () => {
    const s = scenario({ battlefields: { p2: "Bandle Tree" } });
    const facedown = placeUnit(s, "p2", "Caitlyn, Patrolling", "battlefieldA", "facedown");
    facedown.hidden = true;
    setControl(s.room, "battlefieldA", "p2");
    placeUnit(s, "p1", "Clockwork Keeper", "base", "mover");
    s.as("p1").move("Clockwork Keeper", "battlefieldA").expectOk();
    expect(s.room.rules?.combat).toBe(null);
    passUntilSettled(s);
    expect(s.room.rules?.combat).toBe(null);
    expect(s.room.rules?.objects.battlefieldA?.controller).toBe("p1");
  });
});
