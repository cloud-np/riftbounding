/**
 * Known gaps found by the edge-case audit and NOT fixed in this pass — docs/rules/edge-cases-audit.md.
 *
 * Each `it.skip("[BUG] …")` is a reproduction of the rule as written (it fails today). Un-skip it
 * when the fix described in its comment lands. Cards in this file are ranked in the audit by how
 * often they appear in the starter kits (`packages/cards/data/preset-decks.json`).
 */
import { describe, expect, it } from "vitest";
import { runCleanup } from "../../src";
import { register } from "../scenarios/dsl";
import { scenario } from "../scenarios/dsl";
import { boardOf, drive, duel, placeUnit, setControl, toHand } from "./helpers";

describe("rules divergences without a small fix", () => {
  /**
   * Fix: when a Facedown Zone's occupancy drops below the facedown cards there (Bushwhack Trap
   * leaves), its controller chooses that many to trash — a `choose-card` prompt among the
   * facedown cards, run from the Cleanup (cleanup step 5, next to 323.6.a).
   */
  it.skip("[BUG][R107.3.b.2][C:Bushwhack Trap] when the extra facedown slot disappears, the excess facedown card is trashed", () => {
    const s = duel({ p1: ["Bushwhack Trap", "Stand United", "Zhonya's Hourglass"] });
    placeUnit(s, "p1", "Clockwork Keeper", "battlefieldA", "holder");
    setControl(s.room, "battlefieldA", "p1");
    const trap = placeUnit(s, "p1", "Bushwhack Trap", "battlefieldA", "trap");
    s.room.rules!.pools.p1 = { energy: 0, power: { any: 2 } };
    for (const name of ["Stand United", "Zhonya's Hourglass"]) {
      const card = toHand(s, "p1", name);
      s.as("p1").apply({ type: "rules_play", cardId: card.id, hide: true, location: "battlefieldA" }).expectOk();
    }
    expect(boardOf(s, "p1").battlefieldA.filter((card) => card.hidden)).toHaveLength(2);
    s.host.moveCardToOwnerZone(s.room, trap.id, "trash");
    runCleanup(s.room, { ctx: s.ctx, host: s.host, events: [] });
    drive(s);
    expect(boardOf(s, "p1").battlefieldA.filter((card) => card.hidden)).toHaveLength(1);
  });

  /**
   * Fix: `effects/ops/cost-then.ts` `payInstructionCost` discards `hand.slice(-amount)` (the
   * newest cards). With more cards in hand than the cost needs, ask a `choose-card` prompt among
   * the hand (as the `discard` op does) before paying. No printed card reaches this path today
   * (leading trigger costs are paid by the play layer, which does ask), so the impact is latent.
   */
  it.skip("[BUG][R423.1.a][R740.4.a.1] a discard cost inside a spell's instructions lets the player choose the card", () => {
    register({
      name: "Meditation",
      text: "You may discard 1 to draw 2.",
      status: "implemented",
      abilities: [
        { kind: "spell", effect: { op: "cost_then", cost: { discard: 1 }, optional: true, effect: { op: "draw", amount: 2 } } },
      ],
    });
    const s = duel();
    toHand(s, "p1", "Meditation");
    toHand(s, "p1", "Rebuke");
    toHand(s, "p1", "Defy");
    s.room.rules!.pools.p1 = { energy: 2, power: {} };
    s.as("p1").play("Meditation").expectOk();
    const kinds: string[] = [];
    drive(s, { answer: (prompt) => (kinds.push(prompt.kind), prompt.kind === "yes-no" ? ["yes"] : null) });
    expect(kinds).toEqual(["yes-no", "choose-card"]);
  });

  /**
   * Fix: `effects/ops/predict.ts` keeps the order of the cards not recycled. After the recycle
   * choice, when two or more cards stay on top, ask an `order` prompt and put them back in that
   * order (437.1.a "putting the rest back on top of their Main Deck in any order").
   */
  it.skip("[BUG][R437.1.a] Predict 2: the cards kept on top are put back in an order the player chooses", () => {
    register({
      name: "Meditation",
      text: "Predict 2.",
      status: "implemented",
      abilities: [{ kind: "spell", effect: { op: "predict", amount: 2 } }],
    });
    const s = duel();
    toHand(s, "p1", "Meditation");
    s.room.rules!.pools.p1 = { energy: 2, power: {} };
    s.as("p1").play("Meditation").expectOk();
    const kinds: string[] = [];
    drive(s, { answer: (prompt) => (kinds.push(prompt.kind), prompt.kind === "choose-card" ? [] : null) });
    expect(kinds).toContain("order");
  });
});

describe("most-played unfinished starter-kit cards (need a per-turn history primitive)", () => {
  /**
   * Fix (progress.md gap #1): record friendly units/gear that died this turn in `RulesHistory`
   * (reset each turn) and let the entry-ready replacement read it.
   */
  it.skip("[BUG][R369.3][C:Lingering Animus] enters ready if a friendly unit or gear died this turn", () => {
    const s = duel({ p1: ["Lingering Animus"] });
    const victim = placeUnit(s, "p1", "Treasure Hunter", "battlefieldA", "victim");
    s.room.rules!.objects[victim.id] = { ...(s.room.rules!.objects[victim.id] ?? {}), damage: 5 };
    runCleanup(s.room, { ctx: s.ctx, host: s.host, events: [] });
    expect(boardOf(s, "p1").trash.some((card) => card.id === victim.id)).toBe(true);
    toHand(s, "p1", "Lingering Animus");
    s.room.rules!.pools.p1 = { energy: 2, power: {} };
    s.as("p1").play("Lingering Animus").expectOk();
    drive(s);
    expect(s.findBoardCard("Lingering Animus")?.exhausted).toBe(false);
  });

  /**
   * Fix: a per-player, per-turn record of where units/gear were played, read by a cost
   * adjustment that knows the chosen play location before payment (356.4, 420.5).
   */
  it.skip("[BUG][R356.4][C:Hunters' Circle] the first unit a player plays there on their turn costs [1] less", () => {
    const s = scenario({ battlefields: { p1: "Hunters' Circle", p2: "Bandle Tree" } });
    placeUnit(s, "p1", "Treasure Hunter", "battlefieldA", "holder");
    setControl(s.room, "battlefieldA", "p1");
    toHand(s, "p1", "Clockwork Keeper");
    // Only the pool can pay: Clockwork Keeper costs [2], 1 less here.
    for (const rune of boardOf(s, "p1").runeArea) rune.exhausted = true;
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    s.as("p1").play("Clockwork Keeper", { location: "battlefieldA" }).expectOk();
  });

  /** Fix: same per-turn play-location record; Hold 'Em reads "played a unit or gear to a battlefield this turn". */
  it.skip("[BUG][R356.4][C:Hold 'Em] costs [2] less after a unit was played to a battlefield this turn", () => {
    const s = duel({ p1: ["Hold 'Em"] });
    placeUnit(s, "p1", "Treasure Hunter", "battlefieldA", "holder");
    setControl(s.room, "battlefieldA", "p1");
    toHand(s, "p1", "Clockwork Keeper");
    s.room.rules!.pools.p1 = { energy: 3, power: {} };
    s.as("p1").play("Clockwork Keeper", { location: "battlefieldA" }).expectOk();
    drive(s);
    toHand(s, "p1", "Hold 'Em");
    // Only the pool can pay: Hold 'Em costs [3], 2 less.
    for (const rune of boardOf(s, "p1").runeArea) rune.exhausted = true;
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    s.as("p1").play("Hold 'Em", { choices: { "target:0": ["holder"] } }).expectOk();
  });

  /**
   * Fix: `replacements/decisions.ts` only asks when several replacements apply to ONE event (372).
   * For one replacement that can apply to several simultaneous events (373: "They must decide which
   * event to apply Zhonya's Hourglass to first"), hold all qualifying `kill` events of the cleanup
   * and open an `effects.replacement` choose-card prompt (controller of the affected objects, in
   * turn order) listing the units; the chosen one is saved, the rest die (373.2: one sequence).
   * Today the first unit in board order is silently saved.
   */
  it.skip("[BUG][R373][C:Zhonya's Hourglass] two friendly units die in one cleanup: the controller chooses which one Zhonya's Hourglass saves", () => {
    const s = duel({ p1: ["Zhonya's Hourglass"] });
    placeUnit(s, "p1", "Zhonya's Hourglass", "base", "glass");
    placeUnit(s, "p1", "Treasure Hunter", "base", "a");
    placeUnit(s, "p1", "Clockwork Keeper", "base", "b");
    for (const id of ["a", "b"]) s.room.rules!.objects[id] = { damage: 99 };
    runCleanup(s.room, { ctx: s.ctx, host: s.host, events: [] });
    expect(s.room.rules!.prompt?.playerId).toBe("p1");
    expect((s.room.rules!.prompt?.options ?? []).length).toBeGreaterThanOrEqual(2);
    s.as("p1").choose({ optionIds: ["b"] }).expectOk();
    drive(s);
    expect(boardOf(s, "p1").base.some((card) => card.id === "b")).toBe(true);
    expect(boardOf(s, "p1").trash.some((card) => card.id === "a")).toBe(true);
  });

  /**
   * Fix: needs the copy layer (446): "They become copies of me" on the two Reflection tokens (name,
   * Might 3, abilities and, through the copied Temporary, the kill at the next Beginning Phase).
   * The tokens are already Temporary through the script, so only the copy itself is missing.
   */
  it.skip("[BUG][R446][C:Keeper of Masks] the two Reflection tokens become copies of Keeper of Masks", () => {
    const s = duel({ p1: ["Keeper of Masks"] });
    toHand(s, "p1", "Keeper of Masks");
    s.room.rules!.pools.p1 = { energy: 8, power: { any: 8 } };
    s.as("p1").play("Keeper of Masks", { location: "base" }).expectOk();
    drive(s);
    const copies = boardOf(s, "p1").base.filter((card) => card.name === "Keeper of Masks" && card.id !== "keeper");
    expect(copies.length).toBeGreaterThanOrEqual(3);
  });

  /**
   * Fix: a delayed replacement/trigger binds its unit by card id (`target:0` / `obj:<id>`), and a
   * card keeps its id across zones, so the same card played again matches an old binding. Give each
   * board entry an incarnation stamp (set where `baseMight` is initialised on entry) and have the
   * replacement matcher / `bindTarget` store and compare it, or drop `replacement` effects bound to
   * an object in `forgetObject` and `kill` when it leaves the board. Delayed *die/leave* triggers
   * (Deadly Flourish) must keep firing for the object that left, so they compare the stamp instead.
   */
  it.skip("[BUG][R359.3.f][R186][C:Tactical Retreat] a unit that left the board and was played again is a new object: 'the next time it would die this turn' no longer applies", () => {
    const s = duel({ p1: ["Tactical Retreat"] });
    placeUnit(s, "p1", "Stellacorn Herder", "battlefieldA", "u");
    toHand(s, "p1", "Tactical Retreat");
    s.room.rules!.pools.p1 = { energy: 8, power: { any: 8 } };
    s.as("p1").play("Tactical Retreat", { choices: { "target:0": ["u"] } }).expectOk();
    drive(s);
    s.host.moveCardToOwnerZone(s.room, "u", "hand");
    delete s.room.rules!.objects.u;
    s.room.rules!.pools.p1 = { energy: 8, power: { any: 8 } };
    s.as("p1").play("Stellacorn Herder", { location: "base" }).expectOk();
    drive(s);
    s.room.rules!.objects.u = { ...(s.room.rules!.objects.u ?? {}), damage: 99 };
    runCleanup(s.room, { ctx: s.ctx, host: s.host, events: [] });
    drive(s);
    expect(boardOf(s, "p1").trash.some((card) => card.id === "u")).toBe(true);
  });
});
