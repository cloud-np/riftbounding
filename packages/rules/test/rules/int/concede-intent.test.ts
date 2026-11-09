import { describe, expect, it } from "vitest";
import type { GameVariant, RulesIntent } from "@rift/protocol";
import { applyRulesIntent, explainIllegal, validateRulesIntent } from "../../../src";
import { scenario } from "../../scenarios/dsl";
import { table } from "../combat/helpers";

const CONCEDE: RulesIntent = { type: "rules_concede" };

describe("rules_concede intent [R649][R650][R651][R652]", () => {
  it("[R650] the wire shape has no payload and validates", () => {
    expect(validateRulesIntent({ type: "rules_concede" })).toEqual({ ok: true, intent: CONCEDE });
    expect(validateRulesIntent({ type: "rules_concede", hold: "x" })).toMatchObject({
      ok: false,
      code: "illegal_action",
      rule: "650",
    });
  });

  it("[R650][R651.1][R196] a player without Priority concedes; the opponent wins and the game ends", () => {
    const s = scenario();
    expect(s.room.rules?.priority).toBe("p1");
    s.as("p2").apply(CONCEDE).expectOk().expectEvents("concede").expectEvents("game_over");
    expect(s.room.gameOutcome).toMatchObject({ winnerPlayerIds: ["p1"], reason: "concession" });
    // 474 / §5: nothing else is accepted once the game is over.
    s.as("p1").apply({ type: "rules_pass" }).expectError("game_over");
    s.as("p1").apply(CONCEDE).expectError("game_over");
  });

  it("[R650] conceding is legal while another player's prompt is pending", () => {
    const s = scenario();
    s.room.rules!.prompt = {
      id: "prompt_x",
      kind: "yes-no",
      playerId: "p1",
      data: { reason: "test" },
    };
    expect(explainIllegal(s.room, "p2", CONCEDE, s.host)).toEqual({ ok: true });
    s.as("p2").apply(CONCEDE).expectOk();
    expect(s.room.gameOutcome?.winnerPlayerIds).toEqual(["p1"]);
  });

  it("[R651.2][R651.3][R652] in FFA the player is removed and the game continues; a removed player cannot concede again", () => {
    const t = table("free_for_all_3" as GameVariant);
    const result = applyRulesIntent(t.room, "p2", CONCEDE, t.ctx, t.host);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.gameOutcome).toBeUndefined();
    expect(t.host.activePlayerIds(result.room)).toEqual(["p1", "p3"]);
    expect(result.events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["concede", "player_removed"]),
    );
    const again = applyRulesIntent(result.room, "p2", CONCEDE, t.ctx, t.host);
    expect(again).toMatchObject({ ok: false, code: "illegal_action", rule: "651.3" });
    expect(explainIllegal(result.room, "p2", CONCEDE, t.host)).toMatchObject({
      ok: false,
      rule: "651.3",
    });
  });

  it("[R651.4][R491.6.a.1] in 2v2 the conceding player's team loses together", () => {
    const t = table("teams_2v2" as GameVariant);
    const result = applyRulesIntent(t.room, "p3", CONCEDE, t.ctx, t.host);
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.room.gameOutcome?.winnerPlayerIds.slice().sort()).toEqual(["p2", "p4"]);
  });
});
