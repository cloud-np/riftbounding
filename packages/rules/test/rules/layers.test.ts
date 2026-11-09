import { describe, expect, it } from "vitest";
import { combatMight, effectiveKeywords, effectiveMight, explainIllegal } from "../../src";
import { scenario } from "../scenarios/dsl";

describe("layers — effective characteristics [R143.2][R475–R479]", () => {
  it("[R143.2][R143.2.c][R143.2.c.1] effectiveMight = base + temporary Might + buff counters; negative stays negative, uses clamp", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    const rules = s.room.rules!;
    const base = rules.objects[unit.id]?.baseMight ?? s.host.cardInfo(s.room, unit.id)?.might ?? 0;
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(base);

    rules.objects[unit.id] = {
      ...(rules.objects[unit.id] ?? {}),
      baseMight: base,
      temporaryMight: 2,
      buffs: 1,
    };
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(base + 3);

    rules.objects[unit.id]!.temporaryMight = -100;
    // 143.2.c.1: the Might is not 0 — only combat damage and references treat it as 0.
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(base + 1 - 100);
    expect(combatMight(s.room, unit.id, s.host)).toBe(0);
  });

  it("[R475–R479] effectiveKeywords = printed keywords + grantedKeywords, deduped case-insensitively", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    const printed = s.host.cardInfo(s.room, unit.id)?.keywords ?? [];
    expect(effectiveKeywords(s.room, unit.id, s.host)).toEqual(printed);

    s.room.rules!.objects[unit.id] = {
      ...(s.room.rules!.objects[unit.id] ?? {}),
      grantedKeywords: ["Action", "action", "Ganking"],
    };
    const merged = effectiveKeywords(s.room, unit.id, s.host);
    expect(merged.filter((keyword) => keyword.toLowerCase() === "action")).toHaveLength(1);
    expect(merged.map((keyword) => keyword.toLowerCase())).toContain("ganking");
    // The array form is the same layer, used by legality/timing without a second host lookup.
    expect(effectiveKeywords(s.room, unit.id, printed)).toEqual(merged);
  });

  it("[R806.1.b][R813.1.c.1] a granted Action keyword makes a non-Action card legally timed in a Showdown", () => {
    const s = scenario({ p2: { hand: ["Caitlyn, Patrolling"], energy: 3, power: { Calm: 1 } } });
    s.room.rules!.showdown = { battlefield: "battlefieldA", kind: "non_combat", startedBy: "p2" };
    s.room.rules!.focus = "p2";
    s.room.rules!.priority = "p2";
    const card = s.handCard("p2", "Caitlyn, Patrolling")!;
    const intent = { type: "rules_play" as const, cardId: card.id };

    expect(explainIllegal(s.room, "p2", intent, s.host)).toMatchObject({
      ok: false,
      code: "showdown_requires_action",
      rule: "308.1.a",
    });
    s.room.rules!.objects[card.id] = { grantedKeywords: ["Action"] };
    expect(explainIllegal(s.room, "p2", intent, s.host).ok).toBe(true);
  });
});
