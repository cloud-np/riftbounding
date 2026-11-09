/**
 * Official examples in the effects ranges (382–398, 412–446, 701–767, 179–187) that the engine
 * can express. Each title cites the example's rule id.
 */
import { describe, expect, it } from "vitest";
import type { CardScript } from "@rift/protocol";
import {
  effectiveKeywords,
  effectiveMight,
  makeEnv,
  matchingIds,
  registerCardScript,
  xpOf,
} from "../../src";
import { scenario } from "../scenarios/dsl";
import { boardOf, eventTypes, fund, place, run, spell, zoneOf } from "../rules/effects/helpers";

// Tests that override a card's script register it themselves; production scripts stay loaded for
// the rest (no global clear between tests).

function passBoth(s: ReturnType<typeof scenario>, first = "p1"): void {
  s.as(first).pass().expectOk();
  s.as(first === "p1" ? "p2" : "p1").pass().expectOk();
}

describe("official examples — effects", () => {
  it("[EX:710] +3 Might this turn makes a 3 Might unit Mighty; when the effect expires it no longer is", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    s.room.rules!.objects[unit.id] = { baseMight: 3 };
    const ctx = { room: s.room, host: s.host, env: makeEnv({ controller: "p1" }) };
    run(s, { op: "temporary_might", amount: 3, target: { targetRef: "obj:" + unit.id } });
    expect(matchingIds(ctx, { cardType: "unit", mighty: true })).toEqual([unit.id]);
    s.as("p1").endTurn().expectOk();
    const after = { room: s.room, host: s.host, env: makeEnv({ controller: "p1" }) };
    expect(matchingIds(after, { cardType: "unit", mighty: true })).toEqual([]);
  });

  it("[EX:711] a unit in a non-board zone is evaluated by its printed Might", () => {
    const s = scenario();
    const heron = place(s, "p1", "Astral Heron", "trash");
    const ctx = { room: s.room, host: s.host, env: makeEnv({ controller: "p1" }) };
    expect(matchingIds(ctx, { cardType: "unit", zone: "trash", mighty: true })).toEqual([heron.id]);
  });

  it("[EX:719.4.a] statuses of the top-most card and its attached cards are independent", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const blade = place(s, "p1", "Blade of the Exile", "battlefieldA");
    s.host.attach(s.room, blade.id, unit.id);
    run(s, { op: "stun", target: { targetRef: "obj:" + unit.id } }, { controller: "p2" });
    expect(s.room.rules!.objects[unit.id]?.stunned).toBe(true);
    expect(s.room.rules!.objects[blade.id]?.stunned).toBeUndefined();
  });

  it("[EX:722.2] an attached card keeps its printed keywords for references while its rules text is Inactive", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const blade = place(s, "p1", "Blade of the Exile", "battlefieldA");
    s.host.attach(s.room, blade.id, unit.id);
    const ctx = { room: s.room, host: s.host, env: makeEnv({ controller: "p2" }) };
    expect(matchingIds(ctx, { cardType: "gear", keyword: "Equip" })).toEqual([blade.id]);
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Ganking");
  });

  it("[EX:418.8] \"deal X for each …\" deals one instance of damage", () => {
    const s = scenario();
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    place(s, "p1", "Caitlyn, Patrolling", "base");
    place(s, "p1", "Treasure Hunter", "base");
    place(s, "p1", "Stellacorn Herder", "base");
    const { events } = run(s, {
      op: "deal",
      amount: { kind: "count", selector: { cardType: "unit", controller: "self", zone: "base" }, per: 2 },
      target: { targetRef: "obj:" + enemy.id },
    });
    expect(events.filter((event) => event.type === "damage")).toHaveLength(1);
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(6);
  });

  it("[EX:418.6.b.3] a unit named as the source deals the damage itself", () => {
    const s = scenario();
    const mine = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const { events } = run(s, {
      op: "deal",
      amount: { kind: "might", selector: { targetRef: "obj:" + mine.id } },
      target: { targetRef: "obj:" + enemy.id },
      source: { targetRef: "obj:" + mine.id },
    });
    expect(events.find((event) => event.type === "damage")).toMatchObject({ sourceObjectId: mine.id, amount: 3 });
  });

  it("[EX:383.3.e.2.b][EX:386.2.b] a declined optional once-each-turn trigger can still trigger later that turn", () => {
    registerCardScript({
      name: "Treasure Hunter",
      text: "test: Once each turn, when a unit is played, you may gain 1 XP.",
      status: "implemented",
      abilities: [
        {
          kind: "triggered",
          trigger: { kind: "event", event: { type: "unit_played" } },
          effect: { op: "gain_xp", amount: 1 },
          optional: true,
          limit: { kind: "once-per-turn" },
        },
      ],
    });
    const s = scenario({ p1: { hand: ["Caitlyn, Patrolling", "Stellacorn Herder", "Clockwork Keeper"] } });
    place(s, "p1", "Treasure Hunter", "base");
    fund(s, "p1", "Caitlyn, Patrolling", "Stellacorn Herder", "Clockwork Keeper");
    s.as("p1").play("Caitlyn, Patrolling").expectOk();
    s.as("p1").choose({ optionIds: ["no"] }).expectOk();
    s.as("p1").play("Stellacorn Herder").expectOk();
    s.expectPrompt("yes-no", "p1");
    s.as("p1").choose({ optionIds: ["yes"] }).expectOk();
    passBoth(s);
    expect(xpOf(s.room, "p1")).toBe(1);
    s.as("p1").play("Clockwork Keeper").expectOk();
    expect(s.room.rules!.prompt).toBe(null);
  });

  it("[EX:392] Noxian Guillotine: \"Choose a unit. Kill it the next time it takes damage this turn.\" (delayed trigger)", () => {
    registerCardScript(
      spell("Rebuke", {
        op: "delayed",
        trigger: { kind: "event", event: { type: "damage", subject: { targetRef: "target:0" } } },
        effect: { op: "kill", target: { targetRef: "target:0" } },
        once: true,
      }),
    );
    registerCardScript(spell("Gust", { op: "deal", amount: 1, target: { chosen: true, cardType: "unit" } }));
    const s = scenario({ p1: { hand: ["Rebuke", "Gust"], energy: 5 } });
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const other = place(s, "p2", "Astral Heron", "battlefieldA");
    s.as("p1").play("Rebuke", { choices: { "target:0": enemy.id } }).expectOk();
    s.as("p2").pass().expectOk();
    // Damage to another unit does not trigger it.
    s.as("p1").play("Gust", { choices: { "target:0": other.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    s.moveDeckCardToHand("p1", "Gust");
    s.as("p1").play("Gust", { choices: { "target:0": enemy.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.chain[0]?.abilityRef?.startsWith("delayed:")).toBe(true);
    passBoth(s);
    expect(zoneOf(s, enemy.id)).toBe("trash");
  });

  it("[EX:392] Ravenborn Tome: \"The next spell you play this turn deals 1 Bonus Damage.\"", () => {
    registerCardScript(spell("Rebuke", { op: "deal", amount: 2, target: { chosen: true, cardType: "unit" } }));
    registerCardScript(spell("Gust", { op: "deal", amount: 2, target: { chosen: true, cardType: "unit" } }));
    const s = scenario({ p1: { hand: ["Rebuke", "Gust"], energy: 5 } });
    const a = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const b = place(s, "p2", "Astral Heron", "battlefieldA");
    run(s, {
      op: "continuous",
      duration: "this-turn",
      modifier: { kind: "custom", id: "bonus-damage", params: { amount: 1, from: "spells", nextSpell: true } },
    });
    s.as("p1").play("Rebuke", { choices: { "target:0": a.id } }).expectOk();
    s.as("p2").pass().expectOk();
    s.as("p1").play("Gust", { choices: { "target:0": b.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[a.id]?.damage).toBe(3);
    expect(s.room.rules!.objects[b.id]?.damage).toBe(2);
  });

  it("[EX:425.4.a] reveal 2 from the top, put one into your hand and recycle the other", () => {
    const s = scenario();
    const board = boardOf(s, "p1");
    const top = board.deck.slice(-2).map((card) => card.id);
    run(s, {
      op: "look",
      amount: 2,
      then: {
        op: "seq",
        effects: [
          { op: "reveal", target: { targetRef: "looked" } },
          { op: "choose", key: "kept", selector: { zone: "deck", controller: "self", where: { kind: "custom", id: "in-ref", params: { ref: "looked" } } } },
          { op: "return_to_hand", target: { targetRef: "kept" } },
          { op: "recycle", target: { zone: "deck", controller: "self", where: { kind: "custom", id: "in-ref", params: { ref: "looked" } } } },
        ],
      },
    });
    s.expectPrompt("choose-card", "p1");
    s.as("p1").choose({ optionIds: [top[1]!] }).expectOk();
    const after = boardOf(s, "p1");
    expect(after.hand.some((card) => card.id === top[1])).toBe(true);
    expect(after.deck[0]!.id).toBe(top[0]);
  });

  it("[EX:428.3.a] \"Banish the top card of your Main Deck. When you conquer this turn, draw it.\" (linked delayed trigger)", () => {
    const s = scenario();
    const top = boardOf(s, "p1").deck.slice(-1)[0]!;
    run(s, {
      op: "look",
      amount: 1,
      then: {
        op: "seq",
        effects: [
          { op: "banish", target: { targetRef: "looked" } },
          {
            op: "delayed",
            trigger: { kind: "event", event: { type: "conquer", player: "self" } },
            effect: { op: "return_to_hand", target: { targetRef: "looked" } },
          },
        ],
      },
    });
    expect(zoneOf(s, top.id)).toBe("banished");
    place(s, "p1", "Caitlyn, Patrolling", "base");
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    // Showdown at the empty battlefield: both pass Focus → conquer → the delayed trigger fires.
    for (let guard = 0; guard < 8 && zoneOf(s, top.id) !== "hand"; guard += 1) {
      const actor = s.room.rules!.priority ?? s.room.rules!.focus;
      if (!actor) break;
      s.as(actor).pass();
    }
    expect(zoneOf(s, top.id)).toBe("hand");
  });

  it("[EX:383.2.c.2] a watcher that dies in the same action as the other unit does not trigger", () => {
    const watcher: CardScript = {
      name: "Stellacorn Herder",
      text: "test: When another unit you control dies, gain 1 XP.",
      status: "implemented",
      abilities: [
        {
          kind: "triggered",
          trigger: { kind: "event", event: { type: "die", subject: { cardType: "unit", controller: "self", excludeSource: true } } },
          effect: { op: "gain_xp", amount: 1 },
        },
      ],
    };
    registerCardScript(watcher);
    registerCardScript(spell("Rebuke", { op: "deal", amount: 5, target: { chosen: true, cardType: "unit", maxCount: 2 } }));
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2 } });
    const herder = place(s, "p2", "Stellacorn Herder", "battlefieldA");
    const friend = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").play("Rebuke", { choices: { "target:0": [herder.id, friend.id] } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, herder.id)).toBe("trash");
    expect(zoneOf(s, friend.id)).toBe("trash");
    expect(s.room.rules!.chain).toHaveLength(0);
    expect(xpOf(s.room, "p2")).toBe(0);
  });

  it("[EX:383.2.c.2] a surviving watcher triggers when another friendly unit dies", () => {
    registerCardScript({
      name: "Stellacorn Herder",
      text: "test: When another unit you control dies, gain 1 XP.",
      status: "implemented",
      abilities: [
        {
          kind: "triggered",
          trigger: { kind: "event", event: { type: "die", subject: { cardType: "unit", controller: "self", excludeSource: true } } },
          effect: { op: "gain_xp", amount: 1 },
        },
      ],
    });
    registerCardScript(spell("Rebuke", { op: "kill", target: { chosen: true, cardType: "unit" } }));
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2 } });
    place(s, "p2", "Stellacorn Herder", "base");
    const friend = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").play("Rebuke", { choices: { "target:0": friend.id } }).expectOk();
    s.as("p2").pass().expectOk();
    passBoth(s, "p2");
    expect(xpOf(s.room, "p2")).toBe(1);
  });

  it("[EX:433.1.a] doubled Might keeps the +X after a Shield-like bonus stops applying", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    s.room.rules!.objects[unit.id] = { baseMight: 3, mightMods: [{ id: "shield", amount: 2, duration: "this-combat", turn: 1 }] };
    s.room.rules!.combat = { battlefield: "battlefieldA", attacker: "p2", defender: "p1", step: "showdown" };
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(5);
    run(s, { op: "double", target: { targetRef: "obj:" + unit.id } });
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(10);
    s.room.rules!.combat = null;
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(8);
  });

  it("[EX:424.1.a.1] stunning an already stunned unit does not trigger \"when you stun an enemy unit\"", () => {
    registerCardScript({
      name: "Treasure Hunter",
      text: "test: When you stun an enemy unit, gain 1 XP.",
      status: "implemented",
      abilities: [{ kind: "triggered", trigger: { kind: "event", event: { type: "stun", player: "self", subject: { cardType: "unit", controller: "opponent" } } }, effect: { op: "gain_xp", amount: 1 } }],
    });
    registerCardScript(spell("Rebuke", { op: "stun", target: { chosen: true, cardType: "unit" } }));
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2 } });
    place(s, "p1", "Treasure Hunter", "base");
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects[enemy.id] = { stunned: true };
    s.as("p1").play("Rebuke", { choices: { "target:0": enemy.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    expect(eventTypes(s.events())).not.toContain("stun");
  });

  it("[EX:427.1.c] \"Buff a unit. Then, if it was buffed this way, draw a card.\"", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    const effect = {
      op: "seq" as const,
      effects: [
        { op: "buff" as const, target: { targetRef: "obj:" + unit.id } },
        { op: "if" as const, condition: { kind: "custom" as const, id: "did" }, then: { op: "draw" as const, amount: 1 } },
      ],
    };
    const before = boardOf(s, "p1").hand.length;
    run(s, effect);
    expect(boardOf(s, "p1").hand.length).toBe(before + 1);
    run(s, effect);
    expect(boardOf(s, "p1").hand.length).toBe(before + 1);
  });
});
