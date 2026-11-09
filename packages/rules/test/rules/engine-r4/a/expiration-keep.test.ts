/**
 * Lane A (R4-engine) — 317.2.c Expiration Step keep-list.
 *
 * 317.2.c: "Insert '3d. All "this turn" effects expire simultaneously.'" Step 3d clears this-turn
 * state (424.1.a.2 Stunned, lingering 323.2.c designations, "this turn" Might grants) but it must
 * NOT delete the rules object that carries persistent object state: a keyword grant without a
 * duration (801.3.a.3), Empowered (442.2), Might modifications, prevention, counters, the
 * "additional cost was paid" record (356.4.f.1), a Show Off record (832) or a Hidden card's
 * `hiddenTurn`/`hiddenBy` (811.1.b). These are the positive proofs for bugs 1, 3, 4, 8, 9 and 20
 * from progress.md §5; the original `[BUG]` tests stay lead-owned.
 */
import { describe, expect, it } from "vitest";
import { effectiveKeywords } from "../../../../src";
import type { RulesScenario } from "../../../scenarios/dsl";
import { scenario } from "../../../scenarios/dsl";
import { boardOf, fund, place, run, zoneOf } from "../../effects/helpers";

/**
 * A scenario whose extra Main Deck cards are moved to the named players' hands (one copy per
 * entry), like the per-lane `withCards` helpers.
 */
function withCards(p1: string[], p2: string[] = []): RulesScenario {
  const s = scenario({ extraCards: { p1, p2 } });
  for (const [player, names] of [
    ["p1", p1],
    ["p2", p2],
  ] as const) {
    const wanted: Record<string, number> = {};
    for (const name of names) wanted[name] = (wanted[name] ?? 0) + 1;
    for (const [name, count] of Object.entries(wanted)) {
      const inHand = boardOf(s, player).hand.filter((card) => card.name === name).length;
      for (let index = inHand; index < count; index += 1) s.moveDeckCardToHand(player, name);
    }
  }
  return s;
}

/** Pass priority/focus until the chain and any showdown/combat window are empty. */
function settle(s: RulesScenario, maxSteps = 16): void {
  for (let index = 0; index < maxSteps; index += 1) {
    const rules = s.room.rules!;
    if (rules.prompt || s.room.gameOutcome) return;
    if (rules.chain.length === 0 && !rules.showdown && !rules.combat) return;
    const actor = rules.priority ?? rules.focus;
    if (!actor) return;
    s.as(actor).pass().expectOk();
  }
}

describe("[R317.2.c] Expiration Step keep-list", () => {
  it("[C:Fading Memories][R317.2.c][R816.1.b] a gear given Temporary keeps it past the end of turn", () => {
    // 816.1.b: Temporary is "At the start of this permanent's controller's Beginning Phase, before
    // scoring, kill this." The grant must outlive 3d so the trigger exists next turn. The old
    // delete predicate dropped the gear's rules object (gear have no `baseMight`) together with
    // its `keywordGrants`.
    const s = withCards(["Fading Memories"]);
    const gear = place(s, "p2", "Blade of the Exile", "base");
    fund(s, "p1", "Fading Memories");
    s.as("p1")
      .play("Fading Memories", { choices: { "target:0": gear.id } })
      .expectOk();
    settle(s);
    expect(effectiveKeywords(s.room, gear.id, s.host)).toContain("Temporary");

    s.as("p1").endTurn().expectOk();
    expect(effectiveKeywords(s.room, gear.id, s.host)).toContain("Temporary");

    // 816.1.b: p2's Beginning Phase kills it.
    settle(s);
    expect(zoneOf(s, gear.id)).toBe("trash");
  });

  it("[C:Steel Paws][R442.2][R317.2.c] a 0-Might unit keeps Empowered in the Expiration Step", () => {
    // Steel Paws has 0 base Might and gains +7 while Empowered (442.2: Empowered is a board state,
    // not a "this turn" effect). `!object.baseMight` used to treat Might 0 as "no object state".
    const s = withCards(["Steel Paws"]);
    fund(s, "p1", "Steel Paws");
    s.as("p1").play("Steel Paws").expectOk();
    settle(s);
    const paws = s.findBoardCardAnywhere("Steel Paws")!;
    for (const rune of boardOf(s, "p1").runeArea) rune.exhausted = true;
    s.room.rules!.pools.p1 = { energy: 7, power: {} };
    s.as("p1")
      .apply({ type: "rules_activate", objectId: paws.id, ability: "activated:0" })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[paws.id]?.empowered ?? 0).toBeGreaterThan(0);

    s.as("p1").endTurn().expectOk();
    settle(s);
    expect(s.room.rules!.objects[paws.id]?.empowered ?? 0).toBeGreaterThan(0);
  });

  it("[C:Tools of Empire][R442.2][R317.2.c] an Empowered gear keeps Empowered in the Expiration Step", () => {
    const s = withCards(["Tools of Empire"]);
    const tools = place(s, "p1", "Tools of Empire", "base");
    for (const rune of boardOf(s, "p1").runeArea) rune.exhausted = true;
    s.room.rules!.pools.p1 = { energy: 2, power: {} };
    s.as("p1")
      .apply({ type: "rules_activate", objectId: tools.id, ability: "activated:0" })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[tools.id]?.empowered ?? 0).toBeGreaterThan(0);

    s.as("p1").endTurn().expectOk();
    settle(s);
    expect(s.room.rules!.objects[tools.id]?.empowered ?? 0).toBeGreaterThan(0);
  });

  it("[C:Mischievous Marai][R811.1.b][R317.2.c] a card hidden last turn can be played from facedown", () => {
    // 811.1.b: "Beginning on the next turn, this gains [Reaction] and you may play this, ignoring
    // its base cost." `hiddenTurn`/`hiddenBy` live on the rules object; 3d used to delete it.
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
    // Reaction window at the showdown; playing from facedown ignores the base cost (811.1.b).
    s.as("p1").apply({ type: "rules_play", cardId: marai.id }).expectOk();
  });

  it("[R801.3.a.3][R317.2.c] a permanent keyword grant survives the end of turn", () => {
    // 801.3.a.3: "If an effect that grants a Keyword does not specify a duration, the duration is
    // as long as that Game Object remains on the Board."
    const s = withCards([]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    run(s, { op: "grant_keyword", keyword: "Temporary", target: { targetRef: `obj:${unit.id}` } });
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Temporary");

    s.as("p1").endTurn().expectOk();
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Temporary");
  });

  it("[C:The Waters' Wage][R811.1.b][R317.2.c] a card hidden two turns ago can be played from face down", () => {
    const s = withCards(["The Waters' Wage"]);
    place(s, "p1", "Treasure Hunter", "battlefieldA");
    s.room.rules!.objects["battlefieldA"] = { controller: "p1" };
    const wage = s.handCard("p1", "The Waters' Wage")!;
    s.room.rules!.pools.p1 = { energy: 0, power: { Chaos: 1 } };
    s.as("p1")
      .apply({ type: "rules_play", cardId: wage.id, hide: true, location: "battlefieldA" } as never)
      .expectOk();
    s.as("p1").endTurn().expectOk();
    s.as("p2").endTurn().expectOk();
    settle(s);
    expect(s.room.rules!.objects[wage.id]?.hiddenTurn).toBe(1);

    // 811.1.b: play it from face down for [0]; its own text plays three ready Gold tokens.
    s.as("p1").apply({ type: "rules_play", cardId: wage.id }).expectOk();
    settle(s);
    expect(boardOf(s, "p1").base.filter((card) => card.name === "Gold")).toHaveLength(3);
  });

  it("[R356.4.f.1][R317.2.c] a gear keeps the \"additional cost was paid\" record through the Expiration Step", () => {
    // 356.4.f.1: "An optional additional cost was 'paid' if the player made the decision to pay
    // it." The permanent must remember that decision for its "if you paid the additional cost"
    // abilities; gear have no `baseMight`, so the old delete predicate dropped the record.
    const s = withCards([]);
    const gear = place(s, "p1", "Blade of the Exile", "base");
    s.room.rules!.objects[gear.id] = { paidAdditionalCost: true };

    s.as("p1").endTurn().expectOk();
    expect(s.room.rules!.objects[gear.id]?.paidAdditionalCost).toBe(true);
  });

  it("[R317.2.c][R801.3.a.2] a this-turn keyword grant still expires in 3d", () => {
    // 801.3.a.2: the effect specifies the duration. Step 3d must prune it (317.2.c) before the
    // object delete predicate runs, so an expiring grant cannot keep an otherwise-empty rules
    // object alive.
    const s = withCards([]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    run(s, {
      op: "grant_keyword",
      keyword: "Temporary",
      target: { targetRef: `obj:${unit.id}` },
      duration: "this-turn",
    });
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Temporary");

    s.as("p1").endTurn().expectOk();
    expect(effectiveKeywords(s.room, unit.id, s.host)).not.toContain("Temporary");
    expect(s.room.rules!.objects[unit.id]).toBeUndefined();
  });

  it("[R317.2.c][R424.1.a.2] the Expiration Step still clears Stunned", () => {
    // 424.1.a.2: "Stunned Units lose the Stunned status during step 3d of the end of turn cleanup."
    // The keep-list must not preserve transient per-turn statuses.
    const s = withCards([]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    s.room.rules!.objects[unit.id] = { ...(s.room.rules!.objects[unit.id] ?? {}), baseMight: 3, stunned: true };

    s.as("p1").endTurn().expectOk();
    expect(s.room.rules!.objects[unit.id]?.stunned).toBeUndefined();
    // The object itself survives because `baseMight` is persistent object state.
    expect(s.room.rules!.objects[unit.id]?.baseMight).toBe(3);
  });
});
