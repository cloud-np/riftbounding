/**
 * Engine bugs found while scripting Unleashed cards (minimal reproductions, skipped until the
 * engine lane fixes them; card tests work around them where noted).
 */
import { describe, expect, it } from "vitest";
import { effectiveKeywords } from "../../../src";
import { fund, place, run } from "../../rules/effects/helpers";
import { withCards } from "./helpers";

describe("engine bugs (Unleashed lane)", () => {
  /**
   * 811.1.b: a card hidden on an earlier turn may be played from facedown. The hide records
   * `objects[id].hiddenTurn`, but the end-of-turn "3d. expire this-turn effects" cleanup
   * (cleanup/cleanup.ts `expire-this-turn`) deletes every rules object without buffs/baseMight/
   * counters/grantedKeywords — so `hiddenTurn` is gone on the next turn and `facedownPermission`
   * returns null (`not_in_hand` / 420.1.a). Mischievous Marai, Back Off, Evelynn, Pyke, … are
   * unplayable from facedown through the real flow.
   */
  it.skip("[BUG][R811.1.b][R317.2.c] a card hidden last turn can be played from facedown", () => {
    const s = withCards(["Mischievous Marai"]);
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const marai = s.handCard("p1", "Mischievous Marai")!;
    s.room.rules!.pools.p1 = { energy: 0, power: { any: 1 } };
    s.as("p1")
      .apply({ type: "rules_play", cardId: marai.id, hide: true, location: "battlefieldA" })
      .expectOk();
    s.as("p1").endTurn().expectOk();
    place(s, "p2", "Astral Heron", "base");
    s.as("p2").move("Astral Heron", "battlefieldA").expectOk();
    s.as("p2").pass().expectOk();
    s.as("p1").apply({ type: "rules_play", cardId: marai.id }).expectOk();
  });

  /**
   * 801.3.a.3: a keyword granted without a duration lasts while the object stays on the board.
   * The same 3d cleanup deletes rules objects whose only state is `keywordGrants` (and
   * `mightMods`, `empowered`, `prevent`, `paidAdditionalCost`), so e.g. "Give a gear [Temporary]"
   * (Turn to Dust) is lost before the next Beginning Phase and never kills it.
   */
  it.skip("[BUG][R801.3.a.3][R317.2.c] a permanent keyword grant survives the end of turn", () => {
    const s = withCards(["Hextech Ray"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    run(s, { op: "grant_keyword", keyword: "Temporary", target: { targetRef: `obj:${unit.id}` } });
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Temporary");
    fund(s, "p1", "Hextech Ray");
    s.as("p1").endTurn().expectOk();
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Temporary");
  });
});
