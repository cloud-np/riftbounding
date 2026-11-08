/**
 * Restore contract — NEW-6/NEW-7 (rules 312.2.a, 315).
 *
 * A strict in-game room that lost `RulesState` is reconstructed from the Room's own turn fields
 * at Main, with Priority to the Turn Player. Start of Turn (315.1/315.3.b.1/315.4.b) is never
 * replayed, and `applyRulesIntent`, `explainIllegal` and `legalIntents` all use the same path.
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, Room, RulesIntent } from "@rift/protocol";
import { applyRulesIntent, explainIllegal, legalIntents } from "../../src";
import { scenario } from "../scenarios/dsl";
import { boardOf } from "../scenarios/cleanup-helpers";

function zone(room: Room, playerId: string, zoneName: string): CardInstance[] {
  const board = room.players.find((player) => player.id === playerId)?.board;
  if (!board) throw new Error(`no board for ${playerId}`);
  return (board as unknown as Record<string, CardInstance[]>)[zoneName]!;
}

describe("restore contract [R312.2.a][R315]", () => {
  it("[R315][R312.2.a] a missing RulesState restores at Main without extra ready/channel/draw", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    expect(unit.exhausted).toBe(true);

    // Give P1 a visible rune area so a replayed Channel Phase would double it.
    const runes = boardOf(s, "p1").runeDeck.splice(0, 2);
    boardOf(s, "p1").runeArea.push(...runes);
    const runesBefore = zone(s.room, "p1", "runeArea").length;
    const handBefore = zone(s.room, "p1", "hand").length;

    delete s.room.rules;
    const before = JSON.stringify(s.room);

    // NEW-7: views restore on a clone and never mutate the caller's room.
    const explained = explainIllegal(s.room, "p1", { type: "rules_end_turn" }, s.host);
    expect(explained.ok).toBe(true);
    const legal = legalIntents(s.room, "p1", s.host);
    expect(legal.canEndTurn).toBe(true);
    expect(s.room.rules).toBeUndefined();
    expect(JSON.stringify(s.room)).toBe(before);

    const result = applyRulesIntent(s.room, "p1", { type: "rules_end_turn" }, s.ctx, s.host);
    expect(result.ok, result.ok ? "" : `${result.code} (${result.rule})`).toBe(true);
    if (!result.ok) return;

    // A `rules_restored` event is emitted once, and the restored state resumed at Main.
    expect(result.events.filter((event) => event.type === "rules_restored")).toHaveLength(1);
    // 315.1/315.3.b.1/315.4.b: no extra ready, runes or draws for P1.
    expect(zone(result.room, "p1", "runeArea").length).toBe(runesBefore);
    expect(zone(result.room, "p1", "hand").length).toBe(handBefore);
    const restoredUnit = zone(result.room, "p1", "base").find((card) => card.id === unit.id);
    expect(restoredUnit?.exhausted).toBe(true);
    // 317.3: the Ending Step still handed the turn to P2.
    expect(result.room.rules?.turn.player).toBe("p2");
  });

  it("[R315][R312.2.a] a Beginning-step room resumes at the start of Main without replaying Awaken/Channel/Draw", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    const runesBefore = zone(s.room, "p1", "runeArea").length;
    const handBefore = zone(s.room, "p1", "hand").length;
    s.room.activeTurnStep = "beginning";
    delete s.room.rules;

    // NEW-7: the same restored verdict for explain and apply on an illegal intent.
    const passIntent: RulesIntent = { type: "rules_pass" };
    const explained = explainIllegal(s.room, "p1", passIntent, s.host);
    const applied = applyRulesIntent(s.room, "p1", passIntent, s.ctx, s.host);
    expect(explained).toMatchObject({ ok: false, code: "nothing_to_pass", rule: "338.1.b" });
    expect(applied).toMatchObject({ ok: false, code: "nothing_to_pass", rule: "338.1.b" });

    const result = applyRulesIntent(s.room, "p1", { type: "rules_end_turn" }, s.ctx, s.host);
    expect(result.ok, result.ok ? "" : `${result.code} (${result.rule})`).toBe(true);
    if (!result.ok) return;
    const restored = result.events.find((event) => event.type === "rules_restored");
    expect(restored?.data?.roomStep).toBe("beginning");
    expect(restored?.data?.phase).toBe("main");
    expect(zone(result.room, "p1", "runeArea").length).toBe(runesBefore);
    expect(zone(result.room, "p1", "hand").length).toBe(handBefore);
  });

  it("[R312.2.a] a non-strict room is still rejected by all three entry points", () => {
    const s = scenario();
    s.room.rulesMode = "sandbox";
    delete s.room.rules;
    expect(explainIllegal(s.room, "p1", { type: "rules_pass" }, s.host)).toMatchObject({
      ok: false,
      code: "rules_require_strict",
    });
    expect(legalIntents(s.room, "p1", s.host).canEndTurn).toBe(false);
    expect(applyRulesIntent(s.room, "p1", { type: "rules_pass" }, s.ctx, s.host)).toMatchObject({
      ok: false,
      code: "rules_require_strict",
    });
  });
});
