import { afterEach, describe, expect, it } from "vitest";
import {
  dealDamage,
  drawCards,
  kill,
  ready,
  registerActionInterceptor,
  registerFinalizeHook,
  registeredHooks,
  type ActionProposal,
  type RulesStepContext,
} from "../../src";
import { scenario } from "../scenarios/dsl";

/** Every test unsubscribes its hooks so the module-level registries stay empty. */
const unsubscribers: Array<() => void> = [];

afterEach(() => {
  while (unsubscribers.length > 0) unsubscribers.pop()?.();
});

function stepOf(s: ReturnType<typeof scenario>): RulesStepContext {
  return { ctx: s.ctx, host: s.host, events: [] };
}

describe("hook registry [R337.1][R367–R375]", () => {
  it("[R337.1] afterFinalize fires once with the item that became Finalized", () => {
    const seen: Array<{ id: string; status: string; cardName?: string }> = [];
    unsubscribers.push(
      registerFinalizeHook((_room, item) => {
        seen.push({ id: item.id, status: item.status, cardName: item.cardName });
      }),
    );
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ status: "finalized", cardName: "Treasure Hunter" });
    expect(registeredHooks().finalize).toBe(1);
  });

  it("[R367–R375] with no interceptor registered the primitive behaves exactly as before", () => {
    const s = scenario();
    const step = stepOf(s);
    const result = drawCards(s.room, "p1", 1, step);
    expect(result.drawn).toHaveLength(1);
    expect(registeredHooks().actionInterceptors).toBe(0);
  });

  it("[R368] an interceptor returning null prevents the game action", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    const before = (() => {
      const board = s.room.players.find((player) => player.id === "p1")?.board;
      return board?.deck.length ?? 0;
    })();
    unsubscribers.push(
      registerActionInterceptor((_room, _step, proposal) =>
        proposal.type === "draw" || proposal.type === "kill" ? null : proposal,
      ),
    );
    const step = stepOf(s);
    expect(drawCards(s.room, "p1", 1, step).drawn).toHaveLength(0);
    expect(s.room.players.find((player) => player.id === "p1")?.board?.deck.length).toBe(before);
    expect(kill(s.room, unit.id, step)).toBe(false);
    expect(s.host.findCard(s.room, unit.id)?.zone).not.toBe("trash");
  });

  it("[R369/R370] an interceptor can replace an amount (damage 5 → 2)", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    const seen: ActionProposal[] = [];
    unsubscribers.push(
      registerActionInterceptor((_room, _step, proposal) => {
        seen.push(proposal);
        return proposal.type === "deal_damage" ? { ...proposal, amount: 2 } : proposal;
      }),
    );
    expect(dealDamage(s.room, unit.id, 5, stepOf(s))).toBe(2);
    expect(s.room.rules?.objects[unit.id]?.damage).toBe(2);
    expect(seen[0]).toMatchObject({ type: "deal_damage", cardId: unit.id, amount: 5 });
  });

  it("[R367–R375] interceptors chain in registration order and can rewrite the action target", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    const calls: string[] = [];
    unsubscribers.push(
      registerActionInterceptor((_room, _step, proposal) => {
        calls.push("first");
        return proposal;
      }),
    );
    unsubscribers.push(
      registerActionInterceptor((_room, _step, proposal) => {
        calls.push("second");
        return proposal.type === "ready" ? null : proposal;
      }),
    );
    expect(registeredHooks().actionInterceptors).toBe(2);
    const step = stepOf(s);
    expect(dealDamage(s.room, unit.id, 1, step)).toBe(1);
    expect(calls).toEqual(["first", "second"]);
    expect(s.host.setExhausted(s.room, unit.id, true)).toBe(true);
    expect(ready(s.room, unit.id, step)).toBe(false);
    expect(calls).toEqual(["first", "second", "first", "second"]);
  });
});
