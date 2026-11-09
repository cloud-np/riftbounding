/**
 * Wave R4 — Janna, Savior (Spiritforged): the play trigger heals the controller's units at her
 * location, then moves up to one enemy unit there to its base.
 */
import { describe, expect, it } from "vitest";
import { getCardScript } from "../../../src";
import { boardOf, fund, place } from "../../rules/effects/helpers";
import { boardCard, setControl, settle, statusOf, withCards } from "./helpers";

describe("Spiritforged R4 — Janna, Savior", () => {
  it("[C:Janna, Savior][R383.4.a][R419][R421] heals your units here, then moves up to one enemy unit here to its base", () => {
    const s = withCards(["Janna, Savior"]);
    const friend = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const enemy = place(s, "p2", "Treasure Hunter", "battlefieldA");
    setControl(s.room, "battlefieldA", "p1");
    s.room.rules!.objects[friend.id] = { ...(s.room.rules!.objects[friend.id] ?? {}), damage: 2 };

    fund(s, "p1", "Janna, Savior");
    s.as("p1").play("Janna, Savior", { location: "battlefieldA" }).expectOk();
    s.expectPrompt("choose-target", "p1");
    s.as("p1").choose({ optionIds: [enemy.id] }).expectOk();
    settle(s);

    expect(boardCard(s, "p1", "Janna, Savior")?.exhausted).toBe(true);
    expect(s.room.rules!.objects[friend.id]?.damage ?? 0).toBe(0);
    expect(s.host.findCard(s.room, enemy.id)?.zone).toBe("base");
    expect(statusOf("Janna, Savior")).toBe("implemented");
    expect(boardOf(s, "p2").base.some((card) => card.id === enemy.id)).toBe(true);
    expect(getCardScript("Janna, Savior")?.status).toBe("implemented");
  });

  it("[C:Janna, Savior][R355.13] \"up to one\" may choose zero enemy units", () => {
    const s = withCards(["Janna, Savior"]);
    const friend = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const enemy = place(s, "p2", "Treasure Hunter", "battlefieldA");
    setControl(s.room, "battlefieldA", "p1");
    s.room.rules!.objects[enemy.id] = { ...(s.room.rules!.objects[enemy.id] ?? {}), baseMight: 20 };
    s.room.rules!.objects[friend.id] = { ...(s.room.rules!.objects[friend.id] ?? {}), damage: 1 };
    fund(s, "p1", "Janna, Savior");
    s.as("p1").play("Janna, Savior", { location: "battlefieldA" }).expectOk();
    s.expectPrompt("choose-target", "p1");
    s.as("p1").choose({ optionIds: [] }).expectOk();
    // The empty play-time selection is re-asked on resolution (355.18 / 411.2); decline again.
    for (let i = 0; i < 4 && !s.room.rules!.prompt && s.room.rules!.chain.length > 0; i += 1) {
      const who = s.room.rules!.priority;
      if (!who) break;
      s.as(who).pass().expectOk();
    }
    if (s.room.rules!.prompt) {
      s.expectPrompt("choose-target", "p1");
      s.as("p1").choose({ optionIds: [] }).expectOk();
    }
    settle(s);
    expect(s.room.rules!.objects[friend.id]?.damage ?? 0).toBe(0);
    expect(s.host.findCard(s.room, enemy.id)?.zone).toBe("battlefieldA");
  });
});
