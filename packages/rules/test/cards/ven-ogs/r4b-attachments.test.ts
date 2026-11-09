/**
 * Wave R4-cards (VEN/OGS): cards unblocked by R4-engine lanes C/D.
 *
 * - Highlander: delayed replacement matchers read the creating ability's choices
 *   (359.3.f.3.a / 391.3); the old `ven:with-bound` workaround is gone.
 * - Riven, Shattered: Weaponmaster (821.1.b) is a keyword trigger now.
 * - Shady Spectacles: the built-in Equip ability attaches (818.1.c.2); copy (446) stays missing.
 */
import { describe, expect, it } from "vitest";
import { getCardScript } from "../../../src";
import { fund, place } from "../../rules/effects/helpers";
import {
  activate,
  addPool,
  settle,
  withCards,
  zoneOf,
} from "./helpers";

describe("attached cards and delayed replacements [R718][R359.3.f.3.a]", () => {
  it("[C:Highlander][R359.3.f.3.a][R391.3] the delayed matcher reads the chosen unit", () => {
    const s = withCards(["Highlander", "Final Spark"]);
    const unit = place(s, "p1", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Highlander");
    s.as("p1")
      .play("Highlander", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    fund(s, "p1", "Final Spark");
    s.as("p1")
      .play("Final Spark", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    settle(s);
    // 391.3 / 456: heal, exhaust and recall instead of dying (not a move).
    expect(zoneOf(s, unit.id)).toBe("base");
    expect(s.room.rules!.objects[unit.id]?.damage ?? 0).toBe(0);
    expect(s.host.findCard(s.room, unit.id)?.card.exhausted).toBe(true);
  });

  it("[C:Highlander][R359.3.f.3.a] the obsolete ven:with-bound workaround is not in the script", () => {
    expect(JSON.stringify(getCardScript("Highlander"))).not.toContain("ven:with-bound");
  });

  it("[C:Riven, Shattered][R821.1.b][R821.1.c.3] Weaponmaster attaches an Equipment on play", () => {
    const s = withCards(["Riven, Shattered", "Long Sword"]);
    const sword = place(s, "p1", "Long Sword", "base");
    fund(s, "p1", "Riven, Shattered");
    addPool(s, "p1", 0, { Fury: 1 });
    s.as("p1").play("Riven, Shattered").expectOk();
    // 821.1.b: "you may" — the Weaponmaster trigger is optional.
    if (s.room.rules!.prompt?.kind === "yes-no") {
      s.as("p1").choose({ optionIds: ["yes"] }).expectOk();
    }
    settle(s);
    const riven = s.findBoardCardAnywhere("Riven, Shattered")!;
    expect(s.host.findCard(s.room, sword.id)?.card.attachedToCardId).toBe(riven.id);
    expect(s.room.rules!.pools.p1!.power.Fury ?? 0).toBe(0);
  });

  it("[C:Shady Spectacles][R818.1.c.2] the built-in Equip ability attaches the gear", () => {
    const s = withCards(["Shady Spectacles"]);
    const host = place(s, "p1", "Treasure Hunter", "base");
    const specs = place(s, "p1", "Shady Spectacles", "base");
    addPool(s, "p1", 1, { Order: 1 });
    activate(s, "p1", specs, "equip:0", { "target:0": host.id }).expectOk();
    settle(s);
    expect(s.room.rules!.manual).toBeNull();
    expect(s.host.findCard(s.room, specs.id)?.card.attachedToCardId).toBe(host.id);
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
    expect(s.room.rules!.pools.p1!.power.Order ?? 0).toBe(0);
  });
});
