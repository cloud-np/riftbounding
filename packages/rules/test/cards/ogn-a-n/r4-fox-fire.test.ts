/**
 * Wave R4 — Origins A–N upgrades unblocked by R3-engine: Fox-Fire's group targeting (355.11 /
 * 355.13).
 */
import { describe, expect, it } from "vitest";
import { getCardScript } from "../../../src";
import { fund, place, zoneOf } from "../../rules/effects/helpers";
import { withCards } from "./helpers";

describe("Origins A–N R4 upgrades", () => {
  it("[C:Fox-Fire][R355.11][R355.13] kills any number of units at one battlefield with total Might 4 or less", () => {
    const s = withCards(["Fox-Fire", "Fox-Fire"]);
    const a = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const b = place(s, "p2", "Treasure Hunter", "battlefieldA");
    const elsewhere = place(s, "p2", "Astral Heron", "battlefieldB");
    s.room.rules!.objects[a.id] = { ...(s.room.rules!.objects[a.id] ?? {}), baseMight: 2 };
    s.room.rules!.objects[b.id] = { ...(s.room.rules!.objects[b.id] ?? {}), baseMight: 2 };

    fund(s, "p1", "Fox-Fire");
    s.as("p1")
      .play("Fox-Fire", { choices: { "target:0": [a.id, b.id] } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, a.id)).toBe("trash");
    expect(zoneOf(s, b.id)).toBe("trash");
    expect(zoneOf(s, elsewhere.id)).toBe("battlefieldB");

    // 355.11.a: the chosen group must share one location.
    const other = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Fox-Fire");
    s.as("p1")
      .play("Fox-Fire", { choices: { "target:0": [other.id, elsewhere.id] } })
      .expectError("illegal_target");
    expect(getCardScript("Fox-Fire")?.status).toBe("implemented");
  });
});
