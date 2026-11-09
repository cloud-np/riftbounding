/**
 * Wave R4-cards (VEN/OGS): cards unblocked by R4-engine lane B — paying the ordinary cost with
 * runes is not paying the printed optional additional cost (356.4.f.1 / 355.1.a), so the
 * "if you paid the additional cost" play effects now only fire on the real choice.
 */
import { describe, expect, it } from "vitest";
import { boardOf, fund, place } from "../../rules/effects/helpers";
import {
  exhaustRunes,
  settle,
  withCards,
  zoneOf,
} from "./helpers";

describe("optional additional cost flag [R356.4.f.1][R355.1.a]", () => {
  it("[C:Masa, Crashing Thunder][R356.4.f.1] rune payment is not the optional [Order]; only the paid choice stuns", () => {
    const s = withCards(["Masa, Crashing Thunder", "Masa, Crashing Thunder"]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    exhaustRunes(s, "p1");
    // Declined: the ordinary cost is paid from the Rune Pool, not the optional [Order].
    fund(s, "p1", "Masa, Crashing Thunder");
    s.as("p1").play("Masa, Crashing Thunder").expectOk();
    settle(s);
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBeUndefined();
    // Paid: [Order] is chosen as the optional additional cost (355.1.a).
    fund(s, "p1", "Masa, Crashing Thunder");
    s.room.rules!.pools.p1!.power.Order = 1;
    const masa = s.handCard("p1", "Masa, Crashing Thunder")!;
    s.as("p1")
      .apply({ type: "rules_play", cardId: masa.id, optionalCosts: ["optional:0"] })
      .expectOk();
    settle(s);
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBe(true);
  });

  it("[C:Zed, From the Shadows][R356.4.f.1] declining the discard plays no Shadow Clone", () => {
    const s = withCards(["Zed, From the Shadows"]);
    exhaustRunes(s, "p1");
    fund(s, "p1", "Zed, From the Shadows");
    s.as("p1").play("Zed, From the Shadows").expectOk();
    settle(s);
    expect(boardOf(s, "p1").base.some((card) => card.name === "Shadow Clone")).toBe(false);
  });

  it("[C:Zed, From the Shadows][R356.4.f.1] paying the discard plays a 0 Might Shadow Clone", () => {
    const s = withCards(["Zed, From the Shadows", "Rebuke", "Caitlyn, Patrolling"], [], {
      battlefields: { p2: "Bandle Tree" },
    });
    exhaustRunes(s, "p1");
    fund(s, "p1", "Zed, From the Shadows");
    const zed = s.handCard("p1", "Zed, From the Shadows")!;
    s.as("p1")
      .apply({ type: "rules_play", cardId: zed.id, optionalCosts: ["optional:0"] })
      .expectOk();
    // 423.1.a: choose the card discarded for the additional cost.
    const prompt = s.room.rules!.prompt!;
    s.as("p1").choose({ optionIds: [prompt.options![0]!.id] }).expectOk();
    settle(s);
    const clone = boardOf(s, "p1").base.find((card) => card.name === "Shadow Clone");
    expect(clone).toBeTruthy();
    expect(zoneOf(s, zed.id)).toBe("base");
  });

  it("[C:Gust Monk][R356.4.f.1] declining the optional [1] does not queue the play trigger", () => {
    const s = withCards(["Gust Monk"]);
    exhaustRunes(s, "p1");
    fund(s, "p1", "Gust Monk");
    s.as("p1").play("Gust Monk").expectOk();
    settle(s);
    expect(s.room.rules!.prompt).toBeNull();
    expect(s.room.rules!.chain.some((item) => item.cardName === "Gust Monk")).toBe(false);
    expect(s.room.rules!.triggers.some((entry) => entry.sourceName === "Gust Monk")).toBe(false);
  });
});
