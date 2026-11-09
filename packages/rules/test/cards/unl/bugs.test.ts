/**
 * Engine bugs found while scripting Unleashed cards (minimal reproductions, skipped until the
 * engine lane fixes them; card tests work around them where noted).
 */
import { describe, expect, it } from "vitest";
import { effectiveKeywords } from "../../../src";
import { parseRepeatCosts } from "../../../src/play/cost-text";
import { boardOf, fund, place, run, zoneOf } from "../../rules/effects/helpers";
import { hand, settle, withCards } from "./helpers";

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
    const s = withCards([]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    run(s, { op: "grant_keyword", keyword: "Temporary", target: { targetRef: `obj:${unit.id}` } });
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Temporary");
    s.as("p1").endTurn().expectOk();
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Temporary");
  });

  /**
   * 356.4.f.1: "if you paid the additional cost" is about the optional additional cost. R2-play's
   * `paidCostRecord` puts `exhaustedRunes`/`recycledRunes`/`power` into `paid.additional`, and
   * `triggers/finalize.ts` `notePaidAdditionalCost` treats any non-empty `paid.additional` as
   * "paid" — so a card merely paid with runes (or with any Power cost) counts as having paid its
   * optional cost (Clockwork Keeper draws, Pyke Dockside Butcher readies, Nami stuns, …).
   */
  it.skip("[BUG][R356.4.f.1][R355.1.a] paying with runes is not paying the optional additional cost", () => {
    const s = withCards(["Clockwork Keeper"]);
    s.room.rules!.pools.p1 = { energy: 0, power: {} };
    for (const rune of boardOf(s, "p1").runeArea) rune.exhausted = false;
    const before = hand(s, "p1").length;
    s.as("p1").play("Clockwork Keeper").expectOk();
    settle(s);
    // No optional cost chosen: Clockwork Keeper's "if you paid the additional cost, draw 1" must
    // not trigger (hand = before - 1).
    expect(hand(s, "p1")).toHaveLength(before - 1);
  });

  /**
   * 822.1.b: [Ambush] lets a unit be played as a [Reaction] to a battlefield where you have units,
   * whether or not you control it. `play/locations.ts` adds the controlled-battlefield option first
   * and de-duplicates by zone, so the Ambush option (with Reaction timing) is dropped: a defender
   * cannot Ambush into its own battlefield during the attacker's showdown (showdown_requires_action,
   * 308.1.a).
   */
  it.skip("[BUG][R822.1.b][R308.1.a] Ambush to a battlefield you control during a showdown there", () => {
    const s = withCards(["Inferna"], [], { firstPlayer: "p2" });
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    place(s, "p2", "Whiteflame Protector", "base");
    s.as("p2").move("Whiteflame Protector", "battlefieldA").expectOk();
    s.as("p2").pass().expectOk();
    fund(s, "p1", "Inferna");
    s.as("p1").play("Inferna", { location: "battlefieldA" }).expectOk();
  });

  /**
   * 391.3 / 359.3.f.3.a: a delayed replacement ("the next time it would die this turn …") refers to
   * what its creating ability chose. The `replace` op stores the creator's choices, but
   * `replacements/interceptor.ts` `matchesProposal` evaluates `matches` without them, so a matcher
   * like `{ subject: { targetRef: "target:0" } }` never matches (Lane workaround: the custom
   * `unl:replace-next-death` binds the object id literally).
   */
  it.skip("[BUG][R391.3][R359.3.f.3.a] a delayed replacement's matcher sees the creator's choices", () => {
    const s = withCards([]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    run(
      s,
      {
        op: "replace",
        matches: { type: "kill", subject: { targetRef: "target:0" } },
        replace: { op: "recall", target: { targetRef: "event" } },
      },
      { choices: { "target:0": unit.id } },
    );
    run(s, { op: "kill", target: { targetRef: `obj:${unit.id}` } });
    expect(zoneOf(s, unit.id)).toBe("base");
  });

  /**
   * 420.3.b / 355.2.b: a limited play (`play` op, e.g. Thrill of the Hunt "plays it to any
   * battlefield") may put a unit at a battlefield where its controller has no units. The op never
   * records `totalCost`, so `resolvePermanent` (timing/fepr/finalize.ts) treats the location as
   * unvalidated and falls back to the base unless the controller already has a unit there.
   */
  it.skip("[BUG][R420.3.b][R355.2.b] a limited play can enter a battlefield without friendly units", () => {
    const s = withCards(["Thrill of the Hunt"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Thrill of the Hunt");
    s.as("p1")
      .play("Thrill of the Hunt", { choices: { "target:0": unit.id, destination: "battlefieldA" } })
      .expectOk();
    for (let step = 0; step < 6 && s.room.rules!.chain.length > 0; step += 1) {
      s.as(s.room.rules!.priority!).pass().expectOk();
    }
    expect(zoneOf(s, unit.id)).toBe("battlefieldA");
  });

  /**
   * 820.1.c: "[Repeat] - Discard 1" (Square Up's catalog text) — the Repeat cost parser keeps the
   * dash, so the cost becomes `unsupported:` (unpayable, 203.3). Square Up registers its cost
   * explicitly as a workaround.
   */
  it.skip("[BUG][R820.1.c] the Repeat cost parser accepts a dash before a non-symbol cost", () => {
    expect(parseRepeatCosts("[Repeat] - Discard 1 (You may pay the additional cost.)")).toEqual([
      { discard: 1 },
    ]);
  });
});
