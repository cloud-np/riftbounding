import { afterEach, describe, expect, it } from "vitest";
import type { CardScript } from "@rift/protocol";
import {
  clearCardScripts,
  costAdjustments,
  effectiveKeywords,
  effectiveKeywordValues,
  effectiveMight,
  evaluateAmount,
  makeEnv,
  registerCardScript,
  restrictionFor,
} from "../../../src";
import { scenario } from "../../scenarios/dsl";
import { eventTypes, fund, place, run } from "./helpers";

afterEach(() => clearCardScripts());

const BLADE: CardScript = {
  name: "Blade of the Exile",
  text: "test: [Ganking] +3 [Might] (effect text) and a rules-text passive",
  status: "implemented",
  abilities: [
    { kind: "passive", modifier: { kind: "keyword", keyword: "Ganking", target: { targetRef: "host" } } },
    { kind: "passive", modifier: { kind: "might", amount: 3, target: { targetRef: "host" } } },
    // Rules text (inactive while attached, 718.2): friendly units get +1 Might.
    { kind: "passive", modifier: { kind: "might", amount: 1, target: { cardType: "unit", controller: "self" } } },
  ],
};

describe("layers — Might and keywords [R475–R482][R143.2][R716–R719]", () => {
  it("[R364.1][R479.4] a passive Might modifier applies to every matching unit", () => {
    registerCardScript({
      name: "Treasure Hunter",
      text: "test: other friendly units here have +1 Might",
      status: "implemented",
      abilities: [
        {
          kind: "passive",
          modifier: { kind: "might", amount: 1, target: { cardType: "unit", controller: "self", excludeSource: true, zone: { kind: "chosen", ref: "here" } } },
        },
      ],
    });
    const s = scenario();
    const source = place(s, "p1", "Treasure Hunter", "battlefieldA");
    const friend = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const elsewhere = place(s, "p1", "Stellacorn Herder", "base");
    const enemy = place(s, "p2", "Astral Heron", "battlefieldA");
    expect(effectiveMight(s.room, friend.id, s.host)).toBe(4);
    expect(effectiveMight(s.room, source.id, s.host)).toBe(1);
    expect(effectiveMight(s.room, elsewhere.id, s.host)).toBe(3);
    expect(effectiveMight(s.room, enemy.id, s.host)).toBe(7);
  });

  it("[R718.3][R718.4][R479.4.d][R718.2] an attached card's effect text applies to the top-most card; its rules text is Inactive", () => {
    registerCardScript(BLADE);
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const other = place(s, "p1", "Treasure Hunter", "base");
    const blade = place(s, "p1", "Blade of the Exile", "base");
    // Unattached: the rules-text passive applies, the effect text does not (724).
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(4);
    expect(effectiveKeywords(s.room, unit.id, s.host)).not.toContain("Ganking");
    run(s, { op: "attach", gear: { targetRef: "obj:" + blade.id }, to: { targetRef: "obj:" + unit.id } });
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(6);
    expect(effectiveMight(s.room, other.id, s.host)).toBe(1);
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Ganking");
    run(s, { op: "detach", target: { targetRef: "obj:" + blade.id } });
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(4);
  });

  it("[R801.3.a.2][R317.2.c] a keyword granted \"this turn\" expires in the Expiration Step", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects[unit.id] = { baseMight: 3 };
    run(s, { op: "grant_keyword", keyword: "Shield 2", target: { targetRef: "obj:" + unit.id }, duration: "this-turn" });
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Shield");
    expect(effectiveKeywordValues(s.room, unit.id, s.host).shield).toBe(2);
    s.as("p1").endTurn().expectOk();
    expect(effectiveKeywords(s.room, unit.id, s.host)).not.toContain("Shield");
  });

  it("[R801.3.a.3] a keyword granted without a duration lasts while the object stays on the board", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects[unit.id] = { baseMight: 3 };
    run(s, { op: "grant_keyword", keyword: "Assault", target: { targetRef: "obj:" + unit.id } });
    s.as("p1").endTurn().expectOk();
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Assault");
    run(s, { op: "return_to_hand", target: { targetRef: "obj:" + unit.id } });
    expect(effectiveKeywords(s.room, unit.id, s.host)).not.toContain("Assault");
  });

  it("[R801.3.b] a removed keyword is not effective (even when printed)", () => {
    const s = scenario();
    const unit = place(s, "p1", "Reckless Innovator", "base");
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Accelerate");
    run(s, { op: "remove_keyword", keyword: "Accelerate", target: { targetRef: "obj:" + unit.id }, duration: "this-turn" });
    expect(effectiveKeywords(s.room, unit.id, s.host)).not.toContain("Accelerate");
  });

  it("[R823.2][R831.2][EX:831.2] values of a keyword granted by several sources are summed", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    run(s, { op: "grant_keyword", keyword: "Disarm", target: { targetRef: "obj:" + unit.id } });
    run(s, { op: "grant_keyword", keyword: "Disarm", target: { targetRef: "obj:" + unit.id } });
    expect(effectiveKeywordValues(s.room, unit.id, s.host).disarm).toBe(2);
  });

  it("[R479.4.b][EX:479.4.b] a limited arithmetic effect is snapshotted (-4 to a min of 1 on a 2 Might unit is -1)", () => {
    const s = scenario();
    const unit = place(s, "p1", "Clockwork Keeper", "base");
    run(s, { op: "give_might", amount: -4, min: 1, target: { targetRef: "obj:" + unit.id } });
    expect(s.room.rules?.objects[unit.id]?.temporaryMight).toBe(-1);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(1);
  });

  it("[R708][R709][EX:709] a unit \"becomes Mighty\" when its Might goes from below 5 to 5 or more", () => {
    registerCardScript({
      name: "Rebuke",
      text: "test",
      status: "implemented",
      abilities: [{ kind: "spell", effect: { op: "temporary_might", amount: 1, target: { chosen: true, cardType: "unit" } } }],
    });
    const s = scenario({ p1: { hand: ["Rebuke", "Rebuke"], energy: 4 } });
    const unit = place(s, "p1", "Treasure Hunter", "base");
    s.room.rules!.objects[unit.id] = { baseMight: 4 };
    s.as("p1").play("Rebuke", { choices: { "target:0": unit.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(eventTypes(s.events())).toContain("become_mighty");
  });

  it("[R727.1.b][R824.1.b.1][EX:727.1.b.2] a Level ability is Inactive until its controller has enough XP", () => {
    registerCardScript({
      name: "Treasure Hunter",
      text: "test: [Level 3][>] I have +1 [M] and Ganking.",
      status: "implemented",
      abilities: [
        {
          kind: "passive",
          modifier: {
            kind: "custom",
            id: "conditional",
            params: { condition: { kind: "custom", id: "xp-at-least", params: { n: 3 } }, modifier: { kind: "might", amount: 1, target: { targetRef: "self" } } },
          },
        },
        {
          kind: "passive",
          modifier: {
            kind: "custom",
            id: "conditional",
            params: { condition: { kind: "custom", id: "xp-at-least", params: { n: 3 } }, modifier: { kind: "keyword", keyword: "Ganking", target: { targetRef: "self" } } },
          },
        },
      ],
    });
    const s = scenario();
    const unit = place(s, "p1", "Treasure Hunter", "base");
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(1);
    expect(effectiveKeywords(s.room, unit.id, s.host)).not.toContain("Ganking");
    run(s, { op: "gain_xp", amount: 3 });
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(2);
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Ganking");
  });

  it("[R828.1.b.1][R828.1.c] an Empowered ability is active while the object is Empowered", () => {
    registerCardScript({
      name: "Treasure Hunter",
      text: "test: [Empowered][>] I have +2 [M].",
      status: "implemented",
      abilities: [
        {
          kind: "passive",
          modifier: { kind: "custom", id: "conditional", params: { condition: { kind: "custom", id: "self-empowered" }, modifier: { kind: "might", amount: 2, target: { targetRef: "self" } } } },
        },
      ],
    });
    const s = scenario();
    const unit = place(s, "p1", "Treasure Hunter", "base");
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(1);
    run(s, { op: "empower", target: { targetRef: "obj:" + unit.id } });
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(3);
  });

  it("[R478][R478.1.c] a self-referencing conditional passive (Mighty) is evaluated without looping", () => {
    registerCardScript({
      name: "Astral Heron",
      text: "test: While I'm Mighty, I have Deflect.",
      status: "implemented",
      abilities: [
        {
          kind: "passive",
          modifier: { kind: "custom", id: "conditional", params: { condition: { kind: "custom", id: "self-mighty" }, modifier: { kind: "keyword", keyword: "Deflect", target: { targetRef: "self" } } } },
        },
      ],
    });
    const s = scenario();
    const heron = place(s, "p1", "Astral Heron", "base");
    expect(effectiveKeywords(s.room, heron.id, s.host)).toContain("Deflect");
    s.room.rules!.objects[heron.id] = { temporaryMight: -3 };
    expect(effectiveKeywords(s.room, heron.id, s.host)).not.toContain("Deflect");
  });
});

describe("restrictions, costs, entry [R054][R356][R369.3]", () => {
  it("[R054.1][R358.3.a][EX:358.3.a] \"can't\" beats \"can\": a can't-move unit's move instruction is negated", () => {
    registerCardScript({
      name: "Treasure Hunter",
      text: "test: I can't move and can't be readied.",
      status: "implemented",
      abilities: [
        { kind: "passive", modifier: { kind: "restriction", restriction: "move", target: { targetRef: "self" } } },
        { kind: "passive", modifier: { kind: "restriction", restriction: "ready", target: { targetRef: "self" } } },
      ],
    });
    const s = scenario();
    const unit = place(s, "p1", "Treasure Hunter", "base", { exhausted: true });
    expect(restrictionFor(s.room, s.host, { kind: "move", objectId: unit.id })).toMatchObject({ rule: "054.1", sourceObjectId: unit.id });
    expect(eventTypes(run(s, { op: "move", target: { targetRef: "obj:" + unit.id }, to: "battlefieldA" }).events)).not.toContain("move");
    expect(eventTypes(run(s, { op: "ready", target: { targetRef: "obj:" + unit.id } }).events)).not.toContain("ready");
    expect(restrictionFor(s.room, s.host, { kind: "attack", objectId: unit.id })).toBe(null);
  });

  it("[R356.4][R366.2.a] costAdjustments reports discounts that apply to the card being played", () => {
    registerCardScript({
      name: "Treasure Hunter",
      text: "test: Units you play cost [1] less.",
      status: "implemented",
      abilities: [{ kind: "passive", modifier: { kind: "cost", amount: -1, cardType: "unit", target: { cardType: "unit", controller: "self" } } }],
    });
    const s = scenario({ p1: { hand: ["Caitlyn, Patrolling", "Rebuke"] }, p2: { hand: ["Stellacorn Herder"] } });
    place(s, "p1", "Treasure Hunter", "base");
    const unitCard = s.handCard("p1", "Caitlyn, Patrolling")!;
    const spellCard = s.handCard("p1", "Rebuke")!;
    const enemyCard = s.handCard("p2", "Stellacorn Herder")!;
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: unitCard.id })).toEqual([
      expect.objectContaining({ energy: -1, rule: "356.4" }),
    ]);
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: spellCard.id })).toEqual([]);
    expect(costAdjustments(s.room, s.host, { playerId: "p2", cardId: enemyCard.id })).toEqual([]);
  });

  it("[R420.5][EX:420.5] \"the next card you play this turn costs less\" is used up by the next play", () => {
    const s = scenario({ p1: { hand: ["Rebuke", "Gust"], energy: 5 } });
    run(s, {
      op: "continuous",
      duration: "this-turn",
      modifier: { kind: "custom", id: "cost-adjust", params: { energy: -2, power: { any: -2 }, once: true } },
    });
    const rebuke = s.handCard("p1", "Rebuke")!;
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: rebuke.id })).toEqual([
      expect.objectContaining({ energy: -2, power: { any: -2 }, note: "once" }),
    ]);
    s.as("p1").play("Rebuke", { hold: true }).expectOk();
    const gust = s.handCard("p1", "Gust")!;
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: gust.id })).toEqual([]);
  });

  it("[R369.3][EX:369.3] \"units you play to battlefields you control enter ready\" replaces entering exhausted", () => {
    registerCardScript({
      name: "Riven, The Exile",
      text: "Units you play to battlefields you control enter ready.",
      status: "implemented",
      abilities: [{ kind: "passive", modifier: { kind: "custom", id: "enter-ready", params: { battlefieldYouControl: true, target: { cardType: "unit" } } } }],
    });
    const s = scenario({ p1: { hand: ["Caitlyn, Patrolling", "Stellacorn Herder"] } });
    place(s, "p1", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Caitlyn, Patrolling", "Stellacorn Herder");
    s.as("p1").play("Caitlyn, Patrolling", { location: "battlefieldA" }).expectOk();
    const caitlyn = s.findBoardCard("Caitlyn, Patrolling")!;
    expect(caitlyn.exhausted).toBe(false);
    expect(eventTypes(s.events())).not.toContain("ready");
    s.as("p1").play("Stellacorn Herder").expectOk();
    expect(s.findBoardCard("Stellacorn Herder")!.exhausted).toBe(true);
  });
});

describe("negative Might [R143.2.c][R479.4.c]", () => {
  it("[R143.2.c][R143.2.c.1][EX:287] the Might stays negative but an ability referencing it reads 0", () => {
    const s = scenario();
    const unit = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects[unit.id] = { baseMight: 3, temporaryMight: -5 };
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(-2);
    const ctx = { room: s.room, host: s.host, env: makeEnv({ controller: "p1" }) };
    expect(evaluateAmount(ctx, { kind: "might", selector: { targetRef: "obj:" + unit.id } })).toBe(0);
    const { events } = run(s, { op: "kill", target: { targetRef: "obj:" + unit.id } });
    // The kill event's last-known information keeps the actual value (143.2.c.1).
    expect(events.find((event) => event.type === "kill")?.data?.might).toBe(-2);
  });
});
