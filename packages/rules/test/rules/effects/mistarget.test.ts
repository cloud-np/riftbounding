import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { registerActionInterceptor } from "../../../src";
import { scenario } from "../../scenarios/dsl";
import { boardOf, place, registerAll, run, spell, zoneOf } from "./helpers";

const unsubscribe: Array<() => void> = [];
afterEach(() => {
  while (unsubscribe.length > 0) unsubscribe.pop()?.();
});

beforeAll(() =>
  registerAll([
    // Void Seeker: "Deal 4 to a unit at a battlefield. Draw 1."
    spell("Rebuke", {
      op: "seq",
      effects: [
        { op: "deal", amount: 4, target: { chosen: true, cardType: "unit", zone: "battlefield" } },
        { op: "draw", amount: 1 },
      ],
    }),
    // Hidden Blade: "Kill a unit at a battlefield. Its controller draws 2."
    spell("Gust", {
      op: "seq",
      effects: [
        { op: "kill", target: { chosen: true, cardType: "unit", zone: "battlefield" } },
        { op: "draw", amount: 2, player: { kind: "controller", of: { targetRef: "target:0" } } },
      ],
    }),
    // Deathgrip: "Kill a friendly unit. If you do, give +[M] equal to its Might to another
    // friendly unit this turn."
    spell("Defy", {
      op: "seq",
      effects: [
        { op: "kill", target: { chosen: true, cardType: "unit", controller: "self" } },
        {
          op: "if",
          condition: { kind: "custom", id: "did" },
          then: {
            op: "temporary_might",
            amount: { kind: "might", selector: { targetRef: "target:0" } },
            target: { chosen: true, cardType: "unit", controller: "self", excludeRefs: ["target:0"] },
          },
        },
      ],
    }),
  ]),
);

function handSize(s: ReturnType<typeof scenario>, player: string): number {
  return boardOf(s, player).hand.length;
}

describe("mistargeting on resolution [R359.3.e]", () => {
  it("[R359.3.e.5][EX:359.3.e.5] a target that moved to base is not dealt damage; the draw still happens", () => {
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2 } });
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").play("Rebuke", { choices: { "target:0": enemy.id } }).expectOk();
    // In reaction the controller moves the unit to their base.
    s.host.moveCard(s.room, "p2", "battlefieldA", "base", enemy.id);
    const before = handSize(s, "p1");
    s.as("p2").pass().expectOk();
    expect(s.room.rules?.objects[enemy.id]?.damage ?? 0).toBe(0);
    expect(handSize(s, "p1")).toBe(before + 1);
    expect(s.events().some((event) => event.type === "mistarget" && event.targetIds?.includes(enemy.id))).toBe(true);
  });

  it("[R359.3.e.3][EX:359.3.e.3] a target that leaves and meets the requirements again is legal", () => {
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2 } });
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").play("Rebuke", { choices: { "target:0": enemy.id } }).expectOk();
    s.host.moveCard(s.room, "p2", "battlefieldA", "base", enemy.id);
    s.host.moveCard(s.room, "p2", "base", "battlefieldA", enemy.id);
    s.as("p2").pass().expectOk();
    // 3 Might, 4 damage → dies in the cleanup after resolution.
    expect(zoneOf(s, enemy.id)).toBe("trash");
  });

  it("[R359.3.e.2][R359.3.e.4] a target that changed to a non-board zone is illegal", () => {
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2 } });
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").play("Rebuke", { choices: { "target:0": enemy.id } }).expectOk();
    s.host.moveCardToOwnerZone(s.room, enemy.id, "hand");
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, enemy.id)).toBe("hand");
    expect(s.room.rules?.objects[enemy.id]?.damage ?? 0).toBe(0);
  });

  it("[R359.3.e.4] a target that went to a non-board zone and came back is a new object (illegal)", () => {
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2 } });
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").play("Rebuke", { choices: { "target:0": enemy.id } }).expectOk();
    expect(s.room.rules!.objects[enemy.id]?.targetedBy).toEqual([s.room.rules!.chain[0]!.id]);
    // In reaction it is returned to hand (its rules object is dropped) and put back.
    run(s, { op: "return_to_hand", target: { targetRef: "obj:" + enemy.id } }, { controller: "p2" });
    s.host.moveCard(s.room, "p2", "hand", "battlefieldA", enemy.id);
    expect(zoneOf(s, enemy.id)).toBe("battlefieldA");
    s.as("p2").pass().expectOk();
    expect(s.room.rules?.objects[enemy.id]?.damage ?? 0).toBe(0);
    expect(s.events().some((event) => event.type === "mistarget")).toBe(true);
  });

  it("[R359.3.e.14][EX:359.3.e.14] linked instructions: the killed unit's controller draws 2", () => {
    const s = scenario({ p1: { hand: ["Gust"], energy: 1 } });
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").play("Gust", { choices: { "target:0": enemy.id } }).expectOk();
    const before = handSize(s, "p2");
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, enemy.id)).toBe("trash");
    // 359.3.e.13: "its controller" looks back at the unit before it changed zones.
    expect(handSize(s, "p2")).toBe(before + 2);
  });

  it("[R359.3.e.14.a][EX:359.3.e.14.a] an ignored earlier linked instruction ignores the later one", () => {
    const s = scenario({ p1: { hand: ["Gust"], energy: 1 } });
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").play("Gust", { choices: { "target:0": enemy.id } }).expectOk();
    s.host.moveCard(s.room, "p2", "battlefieldA", "base", enemy.id);
    const before = handSize(s, "p2");
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, enemy.id)).toBe("base");
    expect(handSize(s, "p2")).toBe(before);
  });

  it("[R359.3.e.14.b][EX:359.3.e.14.b] a negated (replaced) kill does not stop a linked instruction that doesn't reference it", () => {
    const s = scenario({ p1: { hand: ["Gust"], energy: 1 } });
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    unsubscribe.push(registerActionInterceptor((_room, _step, proposal) => (proposal.type === "kill" ? null : proposal)));
    s.as("p1").play("Gust", { choices: { "target:0": enemy.id } }).expectOk();
    const before = handSize(s, "p2");
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, enemy.id)).toBe("battlefieldA");
    expect(handSize(s, "p2")).toBe(before + 2);
  });

  it("[R359.3.e.14.b][EX:359.3.e.14.b] \"if you do\" does not execute when the referenced action was replaced (Deathgrip)", () => {
    const s = scenario({ p1: { hand: ["Defy"], energy: 1 } });
    const victim = place(s, "p1", "Caitlyn, Patrolling", "base");
    const other = place(s, "p1", "Treasure Hunter", "base");
    unsubscribe.push(registerActionInterceptor((_room, _step, proposal) => (proposal.type === "kill" ? null : proposal)));
    s.as("p1").play("Defy", { choices: { "target:0": victim.id, "target:1": other.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules?.objects[other.id]?.temporaryMight ?? 0).toBe(0);
  });

  it("[R359.3.e.14.b] Deathgrip without replacement: the other unit gets the killed unit's Might", () => {
    const s = scenario({ p1: { hand: ["Defy"], energy: 1 } });
    const victim = place(s, "p1", "Caitlyn, Patrolling", "base");
    const other = place(s, "p1", "Treasure Hunter", "base");
    s.as("p1").play("Defy", { choices: { "target:0": victim.id, "target:1": other.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, victim.id)).toBe("trash");
    expect(s.room.rules?.objects[other.id]?.temporaryMight).toBe(3);
  });

  it("[R359.3.e.10][EX:359.3.e.10] a spell whose only instruction mistargets still resolves and goes to the trash", () => {
    registerAll([spell("En Garde", { op: "deal", amount: 2, target: { chosen: true, cardType: "unit", zone: "battlefield" } })]);
    const s = scenario({ p1: { hand: ["En Garde"], energy: 1 } });
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").play("En Garde", { choices: { "target:0": enemy.id } }).expectOk();
    s.host.moveCard(s.room, "p2", "battlefieldA", "base", enemy.id);
    s.as("p2").pass().expectOk();
    s.expectZone("p1", "En Garde", "trash");
    expect(s.room.rules?.manual).toBe(null);
  });
});
