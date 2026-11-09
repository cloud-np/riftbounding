/**
 * Wave R4-cards (VEN/OGS): cards unblocked by R4-engine lane C — the kill event carries the
 * dead object's last-known Empowered status (383.2.c.3.b / 424), so an [Empowered] [Deathknell]
 * can be detected while the object is already in the trash (808, 828.1.c).
 */
import { describe, expect, it } from "vitest";
import { boardOf, fund, place } from "../../rules/effects/helpers";
import { runeCount, settle, withCards, zoneOf } from "./helpers";

describe("Empowered Deathknell [R808][R828.1.c][R383.2.c.3.b]", () => {
  it("[C:Baccai Witherclaw][R808][R424] dying while Empowered channels 2 runes exhausted", () => {
    const s = withCards(["Final Spark"], ["Baccai Witherclaw"]);
    const wither = place(s, "p2", "Baccai Witherclaw", "battlefieldA");
    s.room.rules!.objects[wither.id] = { ...(s.room.rules!.objects[wither.id] ?? {}), empowered: 1 };
    const before = runeCount(s, "p2");
    fund(s, "p1", "Final Spark");
    s.as("p1")
      .play("Final Spark", { choices: { "target:0": wither.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    settle(s);
    expect(zoneOf(s, wither.id)).toBe("trash");
    expect(runeCount(s, "p2")).toBe(before + 2);
    const channelled = boardOf(s, "p2").runeArea.slice(-2);
    expect(channelled.every((rune) => rune.exhausted)).toBe(true);
  });

  it("[C:Baccai Witherclaw][R808] dying without Empowered does not channel", () => {
    const s = withCards(["Final Spark"], ["Baccai Witherclaw"]);
    const wither = place(s, "p2", "Baccai Witherclaw", "battlefieldA");
    const before = runeCount(s, "p2");
    fund(s, "p1", "Final Spark");
    s.as("p1")
      .play("Final Spark", { choices: { "target:0": wither.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    settle(s);
    expect(zoneOf(s, wither.id)).toBe("trash");
    expect(runeCount(s, "p2")).toBe(before);
  });

  it("[C:Noxian Emissary][R808][R440.2.c] dying while Empowered plays two Recruit tokens", () => {
    const s = withCards(["Final Spark"], ["Noxian Emissary"]);
    const emissary = place(s, "p2", "Noxian Emissary", "battlefieldA");
    s.room.rules!.objects[emissary.id] = {
      ...(s.room.rules!.objects[emissary.id] ?? {}),
      empowered: 1,
    };
    fund(s, "p1", "Final Spark");
    s.as("p1")
      .play("Final Spark", { choices: { "target:0": emissary.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    settle(s);
    expect(zoneOf(s, emissary.id)).toBe("trash");
    const recruits = boardOf(s, "p2").base.filter((card) => card.name === "Recruit");
    expect(recruits).toHaveLength(2);
  });

  it("[C:Noxian Emissary][R808] dying without Empowered plays no tokens", () => {
    const s = withCards(["Final Spark"], ["Noxian Emissary"]);
    const emissary = place(s, "p2", "Noxian Emissary", "battlefieldA");
    fund(s, "p1", "Final Spark");
    s.as("p1")
      .play("Final Spark", { choices: { "target:0": emissary.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    settle(s);
    expect(zoneOf(s, emissary.id)).toBe("trash");
    expect(boardOf(s, "p2").base.some((card) => card.name === "Recruit")).toBe(false);
  });
});
