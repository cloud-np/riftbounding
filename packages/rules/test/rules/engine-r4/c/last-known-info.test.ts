/**
 * Lane C (R4-engine) — last-known information on kill/die (383.2.c.3.b, 424, 442, 427, 808.1.d.3);
 * the `kill` event carries the state of the object before `rules.objects[id]` is dropped and
 * `matchesSelector` falls back to it for `stunned` / `buffed` / `empowered`.
 */
import { describe, expect, it } from "vitest";
import { executeEffect, flushPendingTriggers, getCardScript, registerCardScript } from "../../../../src";
import { fund, place, stepFor, zoneOf } from "../../effects/helpers";
import { put, resolveAll, withCards } from "../../../cards/rad/helpers";
import { withCards as unlCards } from "../../../cards/unl/helpers";

/** Kill directly through the action primitive so the emitted event/trigger can be inspected. */
function killDirect(s: ReturnType<typeof unlCards>, cardId: string, controller = "p1") {
  const step = stepFor(s);
  executeEffect({ op: "kill", target: { targetRef: `obj:${cardId}` } }, { room: s.room, step, controller });
  return step;
}

describe("last-known information on kill/die [R383.2.c.3.b]", () => {
  it("[R424][R383.2.c.3.b] a kill event carries the dead unit's stunned status and object state", () => {
    const s = unlCards([]);
    const unit = place(s, "p1", "Treasure Hunter", "battlefieldA");
    s.room.rules!.objects[unit.id] = {
      ...s.room.rules!.objects[unit.id],
      stunned: true,
      buffs: 2,
      empowered: 1,
    };
    const step = killDirect(s, unit.id);
    const event = step.events.find((entry) => entry.type === "kill")!;
    expect(event).toMatchObject({ cardId: unit.id, zone: "battlefieldA" });
    expect(event.data).toMatchObject({ stunned: true, buffs: 2, empowered: 1 });
    expect(zoneOf(s, unit.id)).toBe("trash");
  });

  it("[R427][R442][R383.2.c.3.b] a die-event selector reads the dead unit's buffed and Empowered status", () => {
    // A living observer ("When a friendly unit dies, …") with subject filters that only the
    // last-known information can satisfy.
    const original = getCardScript("Caitlyn, Patrolling");
    registerCardScript({
      name: "Caitlyn, Patrolling",
      text: "test watcher",
      status: "implemented",
      abilities: [
        {
          kind: "triggered",
          trigger: {
            kind: "event",
            event: { type: "die", subject: { cardType: "unit", controller: "self", buffed: true, empowered: true } },
          },
          effect: { op: "gain_xp", amount: 1 },
        },
      ],
    });
    try {
      const s = unlCards([]);
      place(s, "p1", "Caitlyn, Patrolling", "base");
      const victim = place(s, "p1", "Treasure Hunter", "battlefieldA");
      s.room.rules!.objects[victim.id] = { ...s.room.rules!.objects[victim.id], buffs: 1, empowered: 1 };
      const step = killDirect(s, victim.id);
      flushPendingTriggers(s.room, step);
      expect(s.room.rules!.chain.some((item) => item.cardName === "Caitlyn, Patrolling")).toBe(true);
    } finally {
      if (original) registerCardScript(original);
    }
  });

  it("[C:Storm Raptor][R424][R383.2.c.3] a stunned enemy unit dying here triggers the draw", () => {
    const s = withCards(["Lost to the Sands"], ["Storm Raptor"]);
    put(s, "p2", "Storm Raptor", "battlefieldA");
    const victim = put(s, "p1", "Treasure Hunter", "battlefieldA");
    s.room.rules!.objects[victim.id] = { ...s.room.rules!.objects[victim.id], stunned: true };
    fund(s, "p1", "Lost to the Sands");
    const before = s.room.players.find((player) => player.id === "p2")!.board!.hand.length;
    s.as("p1")
      .play("Lost to the Sands", { choices: { mode: "deal", "target:0": victim.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    const trigger = s.room.rules!.chain.find((item) => item.cardName === "Storm Raptor");
    expect(trigger, "Storm Raptor's death trigger is on the chain").toBeTruthy();
    expect(trigger!.triggerEvent).toMatchObject({ type: "kill", zone: "battlefieldA", data: { stunned: true } });
    resolveAll(s);
    const after = s.room.players.find((player) => player.id === "p2")!.board!.hand.length;
    expect(after).toBe(before + 1);
  });

  it("[C:Storm Raptor][R424] an unstunned enemy unit dying here does not trigger", () => {
    const s = withCards(["Lost to the Sands"], ["Storm Raptor"]);
    put(s, "p2", "Storm Raptor", "battlefieldA");
    const victim = put(s, "p1", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Lost to the Sands");
    s.as("p1")
      .play("Lost to the Sands", { choices: { mode: "deal", "target:0": victim.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.chain.some((item) => item.cardName === "Storm Raptor")).toBe(false);
    resolveAll(s);
    expect(zoneOf(s, victim.id)).toBe("trash");
  });
});
