import { afterEach, describe, expect, it } from "vitest";
import type { CardScript, Effect, Trigger } from "@rift/protocol";
import {
  clearCardScripts,
  effectiveMight,
  executeEffect,
  flushPendingTriggers,
  registerCardScript,
  xpOf,
} from "../../../src";
import { scenario } from "../../scenarios/dsl";
import { boardOf, place, spell, stepFor, zoneOf } from "./helpers";

afterEach(() => clearCardScripts());

function triggered(name: string, trigger: Trigger, effect: Effect, extra: Partial<Extract<CardScript["abilities"][number], { kind: "triggered" }>> = {}): CardScript {
  return { name, text: "test trigger", status: "implemented", abilities: [{ kind: "triggered", trigger, effect, ...extra }] };
}

const PLAYED_SELF: Trigger = { kind: "event", event: { type: ["unit_played"], subject: { targetRef: "self" } } };
const DIES_SELF: Trigger = { kind: "event", event: { type: "die", subject: { targetRef: "self" } } };
const KILL_SPELL = spell("Rebuke", { op: "kill", target: { chosen: true, cardType: "unit" } });

function handSize(s: ReturnType<typeof scenario>, player: string): number {
  return boardOf(s, player).hand.length;
}

describe("triggered abilities [R382–R386][R402–R407]", () => {
  it("[R383.4.a][R383.4.a.2] a play effect goes on the chain after the permanent enters the board", () => {
    registerCardScript(triggered("Treasure Hunter", PLAYED_SELF, { op: "draw", amount: 1 }));
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    s.expectZone("p1", "Treasure Hunter", "base");
    const chain = s.room.rules!.chain;
    expect(chain).toHaveLength(1);
    expect(chain[0]).toMatchObject({ kind: "triggered", origin: "trigger", status: "finalized", controller: "p1", cardName: "Treasure Hunter" });
    s.expectState("neutral_closed").expectPriority("p1");
    const before = handSize(s, "p1");
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    expect(handSize(s, "p1")).toBe(before + 1);
    expect(s.room.rules?.chain).toHaveLength(0);
    s.expectState("neutral_open");
  });

  it("[R383.2.c.3][R808.1.d.2][EX:383.2.c.3] a Deathknell-style trigger fires when the unit is killed", () => {
    registerCardScript(KILL_SPELL);
    registerCardScript(triggered("Stellacorn Herder", DIES_SELF, { op: "draw", amount: 2 }));
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2 } });
    const herder = place(s, "p2", "Stellacorn Herder", "battlefieldA");
    s.as("p1").play("Rebuke", { choices: { "target:0": herder.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, herder.id)).toBe("trash");
    const chain = s.room.rules!.chain;
    expect(chain).toHaveLength(1);
    expect(chain[0]).toMatchObject({ kind: "triggered", controller: "p2", sourceObjectId: herder.id });
    expect(chain[0]!.triggerEvent).toMatchObject({ type: "kill", zone: "battlefieldA" });
    const before = handSize(s, "p2");
    s.as("p2").pass().expectOk();
    s.as("p1").pass().expectOk();
    expect(handSize(s, "p2")).toBe(before + 2);
  });

  it("[R383.2.c.3.a][EX:383.2.c.3.a] a replaced death does not trigger \"when I die\"", () => {
    registerCardScript(KILL_SPELL);
    registerCardScript(triggered("Stellacorn Herder", DIES_SELF, { op: "draw", amount: 2 }));
    registerCardScript({
      name: "Blade of the Exile",
      text: "test: If a friendly unit would die, recall it instead.",
      status: "implemented",
      abilities: [
        {
          kind: "replacement",
          matches: { type: "kill", subject: { cardType: "unit", controller: "self" } },
          replace: { op: "recall", target: { targetRef: "event" } },
        },
      ],
    });
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2 } });
    const herder = place(s, "p2", "Stellacorn Herder", "battlefieldA");
    place(s, "p2", "Blade of the Exile", "base");
    s.as("p1").play("Rebuke", { choices: { "target:0": herder.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, herder.id)).toBe("base");
    expect(s.room.rules?.chain).toHaveLength(0);
  });

  it("[R384.2] triggered abilities of permanents only trigger while on the board", () => {
    registerCardScript(triggered("Treasure Hunter", { kind: "event", event: { type: "unit_played" } }, { op: "gain_xp", amount: 1 }));
    registerCardScript(spell("Caitlyn, Patrolling", { op: "seq", effects: [] }));
    const s = scenario({ p1: { hand: ["Caitlyn, Patrolling", "Treasure Hunter"], energy: 9 } });
    s.as("p1").play("Caitlyn, Patrolling").expectOk();
    expect(s.room.rules?.chain).toHaveLength(0);
    expect(xpOf(s.room, "p1")).toBe(0);
  });

  it("[R383.3.d.1][R303.2.a] simultaneous triggers of different players: Turn Player places first", () => {
    const watcher = triggered("Treasure Hunter", { kind: "event", event: { type: "unit_played" } }, { op: "gain_xp", amount: 1 });
    registerCardScript(watcher);
    const s = scenario({ p1: { hand: ["Caitlyn, Patrolling"], energy: 9 } });
    place(s, "p1", "Treasure Hunter", "base");
    place(s, "p2", "Treasure Hunter", "base");
    s.as("p1").play("Caitlyn, Patrolling").expectOk();
    const chain = s.room.rules!.chain;
    expect(chain.map((item) => item.controller)).toEqual(["p1", "p2"]);
    // 340.4: the newest item (P2's) resolves first; its controller holds Priority.
    s.expectPriority("p2");
  });

  it("[R383.3.d][R466.2.d.1] opts.order places the Attacker's triggers first and the Defender's last", () => {
    const s = scenario();
    s.room.rules!.triggers.push(
      { id: "t-defender", controller: "p1", sourceName: "A" },
      { id: "t-attacker", controller: "p2", sourceName: "B" },
    );
    const added = flushPendingTriggers(s.room, stepFor(s), { order: ["p2", "p1"] });
    expect(added).toBe(2);
    expect(s.room.rules!.chain.map((item) => item.controller)).toEqual(["p2", "p1"]);
    expect(s.room.rules!.triggers).toHaveLength(0);
  });

  it("[R383.3.d] a player orders their own simultaneous triggers", () => {
    registerCardScript(triggered("Treasure Hunter", { kind: "event", event: { type: "unit_played" } }, { op: "gain_xp", amount: 1 }));
    registerCardScript(triggered("Stellacorn Herder", { kind: "event", event: { type: "unit_played" } }, { op: "draw", amount: 1 }));
    const s = scenario({ p1: { hand: ["Caitlyn, Patrolling"], energy: 9 } });
    const hunter = place(s, "p1", "Treasure Hunter", "base");
    place(s, "p1", "Stellacorn Herder", "base");
    s.as("p1").play("Caitlyn, Patrolling").expectOk();
    s.expectPrompt("order", "p1");
    const prompt = s.room.rules!.prompt!;
    expect(prompt.data?.reason).toBe("effects.order_triggers");
    const hunterTrigger = prompt.options!.find((option) => option.objectId === hunter.id)!;
    const herderTrigger = prompt.options!.find((option) => option.objectId !== hunter.id)!;
    s.as("p1").choose({ orderedIds: [herderTrigger.id, hunterTrigger.id] }).expectOk();
    expect(s.room.rules!.chain.map((item) => item.cardName)).toEqual(["Stellacorn Herder", "Treasure Hunter"]);
  });

  it("[R403.1][R383.3.a.2] declining an optional trigger removes it: it is considered not to have triggered", () => {
    registerCardScript(triggered("Treasure Hunter", PLAYED_SELF, { op: "draw", amount: 1 }, { optional: true }));
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    s.expectPrompt("yes-no", "p1");
    expect(s.room.rules!.prompt!.rule).toBe("403.1");
    s.as("p1").choose({ optionIds: ["no"] }).expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    s.expectState("neutral_open").expectPriority("p1");
  });

  it("[R403.1] accepting an optional trigger keeps it on the chain", () => {
    registerCardScript(triggered("Treasure Hunter", PLAYED_SELF, { op: "draw", amount: 1 }, { optional: true }));
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    s.as("p1").choose({ optionIds: ["yes"] }).expectOk();
    expect(s.room.rules!.chain).toHaveLength(1);
    expect(s.room.rules!.chain[0]!.mayDecided).toBe(true);
  });

  it("[R403.4][R403.4.a] a trigger with no legal target is removed (not countered)", () => {
    registerCardScript(
      triggered("Treasure Hunter", PLAYED_SELF, { op: "kill", target: { chosen: true, cardType: "unit", controller: "opponent" } }),
    );
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    expect(s.events().some((event) => event.type === "trigger_removed")).toBe(true);
  });

  it("[R403.2][R403.4.b] trigger targets are chosen on finalization: one option is auto-selected", () => {
    registerCardScript(
      triggered("Treasure Hunter", PLAYED_SELF, { op: "stun", target: { chosen: true, cardType: "unit", controller: "opponent" } }),
    );
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").play("Treasure Hunter").expectOk();
    expect(s.room.rules!.chain[0]!.choices["target:0"]).toBe(enemy.id);
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBe(true);
  });

  it("[R403.2] with several options the trigger's controller chooses the target", () => {
    registerCardScript(
      triggered("Treasure Hunter", PLAYED_SELF, { op: "stun", target: { chosen: true, cardType: "unit", controller: "opponent" } }),
    );
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const second = place(s, "p2", "Stellacorn Herder", "battlefieldA");
    s.as("p1").play("Treasure Hunter").expectOk();
    s.expectPrompt("choose-target", "p1");
    expect(s.room.rules!.prompt!.data?.reason).toBe("effects.trigger_choice");
    s.as("p1").choose({ optionIds: [second.id] }).expectOk();
    expect(s.room.rules!.chain[0]!.choices["target:0"]).toBe(second.id);
    expect(s.room.rules!.chain[0]!.targetSnapshot?.[second.id]).toMatchObject({ zone: "battlefieldA" });
  });

  it("[R383.3.e.1] a \"once each turn\" trigger only triggers once per turn", () => {
    registerCardScript(
      triggered("Treasure Hunter", { kind: "event", event: { type: "unit_played", subject: { cardType: "unit", controller: "self" } } }, { op: "gain_xp", amount: 1 }, {
        limit: { kind: "once-per-turn" },
      }),
    );
    const s = scenario({ p1: { hand: ["Caitlyn, Patrolling", "Stellacorn Herder"], energy: 9 } });
    place(s, "p1", "Treasure Hunter", "base");
    s.as("p1").play("Caitlyn, Patrolling").expectOk();
    expect(s.room.rules!.chain).toHaveLength(1);
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    expect(xpOf(s.room, "p1")).toBe(1);
    s.as("p1").play("Stellacorn Herder").expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
  });

  it("[R383.2.a.1][EX:383.2.a.1] an \"if\" right after the trigger condition must hold for it to trigger", () => {
    registerCardScript(
      triggered("Treasure Hunter", PLAYED_SELF, { op: "draw", amount: 1 }, { condition: { kind: "custom", id: "self-at-battlefield" } }),
    );
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
  });

  it("[R402.1][R323.11] a move trigger keeps the state Closed; the Showdown begins after it resolves", () => {
    registerCardScript(
      triggered("Treasure Hunter", { kind: "event", event: { type: "move", subject: { targetRef: "self" } } }, { op: "gain_xp", amount: 1 }),
    );
    const s = scenario();
    place(s, "p1", "Treasure Hunter", "base");
    s.as("p1").move("Treasure Hunter", "battlefieldA").expectOk();
    expect(s.room.rules!.chain).toHaveLength(1);
    s.expectState("neutral_closed");
    expect(s.room.rules!.showdown).toBe(null);
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    expect(xpOf(s.room, "p1")).toBe(1);
    s.expectState("showdown_open").expectFocus("p1");
  });
});

describe("reflexive and delayed abilities [R387–R393][R359.3.e.16]", () => {
  it("[R388.1.a][R389.2][EX:429.5.d] \"Do this twice\" adds two pending triggered items in order", () => {
    registerCardScript(
      spell("Rebuke", {
        op: "reflexive",
        times: 2,
        effect: { op: "deal", amount: 3, target: { chosen: true, cardType: "unit" } },
      }),
    );
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2 } });
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    s.as("p1").play("Rebuke").expectOk();
    s.as("p2").pass().expectOk();
    const chain = s.room.rules!.chain;
    expect(chain).toHaveLength(2);
    expect(chain.every((item) => item.kind === "triggered" && item.abilityRef === "reflexive")).toBe(true);
    expect(chain[0]!.choices["target:0"]).toBe(enemy.id);
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(6);
  });

  it("[R388.4][EX:388.4] a reflexive trigger's leading \"you may\" is decided on its finalization", () => {
    registerCardScript(spell("Rebuke", { op: "reflexive", optional: true, effect: { op: "gain_xp", amount: 2 } }));
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2 } });
    s.as("p1").play("Rebuke").expectOk();
    s.as("p2").pass().expectOk();
    s.expectPrompt("yes-no", "p1");
    s.as("p1").choose({ optionIds: ["no"] }).expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
  });

  it("[R391.2][R392][R393] a delayed \"at the end of this turn\" trigger resolves in the Ending Step", () => {
    registerCardScript(spell("Rebuke", { op: "delayed", trigger: { kind: "turn-end" }, effect: { op: "gain_xp", amount: 4 } }));
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2 } });
    s.as("p1").play("Rebuke").expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.effects.some((effect) => effect.modifier.kind === "custom" && effect.modifier.id === "delayed-trigger")).toBe(true);
    s.as("p1").endTurn().expectOk();
    expect(s.room.rules!.chain).toHaveLength(1);
    expect(s.room.rules!.chain[0]!.abilityRef?.startsWith("delayed:")).toBe(true);
    s.expectPhase("ending", "ending");
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    expect(xpOf(s.room, "p1")).toBe(4);
    expect(s.room.rules!.turn.player).toBe("p2");
  });

  it("[R359.3.e.16][EX:359.3.e.16] a delayed end-of-turn trigger created during the Ending Phase is not generated", () => {
    registerCardScript(spell("Rebuke", { op: "delayed", trigger: { kind: "turn-end" }, effect: { op: "gain_xp", amount: 4 } }));
    const s = scenario();
    s.room.rules!.turn.phase = "ending";
    s.room.rules!.turn.step = "ending";
    const step = stepFor(s);
    executeEffect({ op: "delayed", trigger: { kind: "turn-end" }, effect: { op: "gain_xp", amount: 4 } }, { room: s.room, step, controller: "p1" });
    expect(s.room.rules!.effects).toHaveLength(0);
  });
});

describe("keyword triggers [R816][R817][R823]", () => {
  it("[R816.1.b][R816.1.c] Temporary kills the permanent at the start of its controller's Beginning Phase, before scoring", () => {
    const s = scenario();
    const unit = place(s, "p2", "Treasure Hunter", "battlefieldA");
    s.room.rules!.objects[unit.id] = { baseMight: 1, grantedKeywords: ["Temporary"] };
    s.as("p1").endTurn().expectOk();
    // P2's turn: the Temporary trigger is on the chain before the Scoring Step.
    expect(s.room.rules!.turn.player).toBe("p2");
    expect(s.room.rules!.turn.phase).toBe("beginning");
    expect(s.room.rules!.chain[0]?.abilityRef).toBe("keyword:temporary:1");
    s.as("p2").pass().expectOk();
    s.as("p1").pass().expectOk();
    expect(zoneOf(s, unit.id)).toBe("trash");
    // No hold point: the unit died before the Scoring Step.
    expect(boardOf(s, "p2").score).toBe(0);
  });

  it("[R817.1.b][R817.1.c] Vision predicts when the permanent is played", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    const card = s.handCard("p1", "Treasure Hunter")!;
    // Give this copy a printed Vision keyword (instance keywords override the catalog's).
    card.keywords = ["Vision"];
    s.as("p1").play("Treasure Hunter").expectOk();
    expect(s.room.rules!.chain[0]?.abilityRef).toBe("keyword:vision:1");
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    s.expectPrompt("choose-card", "p1");
    expect(s.room.rules!.prompt!.rule).toBe("437.1");
  });

  it("[R831.1.d][R383.4.e] Disarm: when the unit attacks, an enemy unit here gets -X Might this turn", () => {
    const s = scenario();
    const defender = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const attacker = place(s, "p1", "Caitlyn, Patrolling", "base");
    s.room.rules!.objects[attacker.id] = {
      baseMight: 3,
      keywordGrants: [{ id: "d1", keyword: "Disarm", value: 2, duration: "permanent", turn: 1 }],
    };
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    expect(s.events().some((event) => event.type === "attack" && event.cardId === attacker.id)).toBe(true);
    expect(s.events().some((event) => event.type === "defend" && event.cardId === defender.id)).toBe(true);
    const disarm = s.room.rules!.chain.find((item) => item.abilityRef?.startsWith("keyword:disarm"));
    expect(disarm?.abilityRef).toBe("keyword:disarm:2");
    expect(disarm?.choices["target:0"]).toBe(defender.id);
    for (let guard = 0; guard < 6 && s.room.rules!.chain.some((item) => item.id === disarm!.id); guard += 1) {
      const who = s.room.rules!.priority;
      if (!who) break;
      s.as(who).pass();
    }
    expect(effectiveMight(s.room, defender.id, s.host)).toBe(6);
  });

  it("[R823.1.c.1][R823.2] Hunt: when the unit holds, its controller gains the summed Hunt value in XP", () => {
    const s = scenario();
    const unit = place(s, "p2", "Treasure Hunter", "battlefieldA");
    s.room.rules!.objects[unit.id] = {
      baseMight: 1,
      keywordGrants: [
        { id: "k1", keyword: "Hunt", value: 2, duration: "permanent", turn: 1 },
        { id: "k2", keyword: "Hunt", duration: "permanent", turn: 1 },
      ],
    };
    s.as("p1").endTurn().expectOk();
    // P2 holds battlefieldA during their Beginning Phase.
    const hunt = s.room.rules!.chain.find((item) => item.abilityRef?.startsWith("keyword:hunt"));
    expect(hunt?.abilityRef).toBe("keyword:hunt:3");
    s.as("p2").pass().expectOk();
    s.as("p1").pass().expectOk();
    expect(xpOf(s.room, "p2")).toBe(3);
  });
});
