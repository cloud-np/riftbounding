/**
 * Unleashed (UNL) R4 — reproductions of engine bugs found by these card tests.
 *
 * Each test is skipped: the engine lanes own the fix. The lane report (`docs/rules/cards/unl.md`)
 * lists the same rows.
 */
import { describe, expect, it } from "vitest";
import { place, run, zoneOf } from "../../rules/effects/helpers";
import { withCards } from "./helpers";

describe("Unleashed R4 — engine bugs", () => {
  it("[C:Altar of Blood][R190.6.a][R371.2.a] the optional replacement is offered to the dying unit's controller, not the Turn Player", () => {
    const s = withCards([], [], { battlefields: { p1: "Altar of Blood" } });
    // The Turn Player (p1) owns no resources; the dying unit and its 3 Energy belong to p2.
    const unit = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.combat = { battlefield: "battlefieldA", attacker: "p1", defender: "p2", step: "damage" };
    s.room.rules!.pools.p2 = { energy: 3, power: {} };
    run(s, { op: "kill", target: { targetRef: `obj:${unit.id}` } }, { controller: "p1" });
    // 372.1: the player the action is being done to (p2) decides; the replacement is payable.
    expect(s.room.rules!.prompt?.playerId).toBe("p2");
    s.as("p2").choose({ optionIds: ["yes"] }).expectOk();
    expect(zoneOf(s, unit.id)).toBe("base");
    expect(s.room.rules!.pools.p2!.energy).toBe(0);
  });
});
