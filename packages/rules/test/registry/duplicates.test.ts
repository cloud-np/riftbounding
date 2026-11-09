/**
 * F1/G1: every import-time registry rejects a second registration under the same key, so a new
 * card or set can never silently replace an existing script or handler. Tests replace entries
 * only through the explicit test-only API (`src/testing.ts`).
 */
import { describe, expect, it } from "vitest";
import type { CardScript } from "@rift/protocol";
import {
  getCardScript,
  getEffectOp,
  getPromptHandler,
  registerActionInterceptor,
  registerCardScript,
  registerCustomCondition,
  registerCustomEffect,
  registerEffectOp,
  registerPromptHandler,
  registerTaskHandler,
} from "../../src";
import type { ActionInterceptor } from "../../src/timing/hooks";
import { registerAdditionalCosts } from "../../src/play/additional-costs";
import { registerPlayPermission } from "../../src/play/permissions";
import { registerCombatContributionFilter } from "../../src/combat/keywords";
import { getTaskHandler } from "../../src/timing/tasks/registry";
import {
  DuplicateRegistrationError,
  overrideAdditionalCosts,
  overrideCardScript,
  overrideCustomCondition,
  overrideCustomEffect,
  overrideEffectOp,
  overridePromptHandler,
  overrideTaskHandler,
  unregisterCardScript,
} from "../../src/testing";

const REAL_CARD = "Caitlyn, Patrolling";

describe("duplicate registrations throw [F1][G1]", () => {
  it("card scripts: a second script for a registered name throws; the original stays", () => {
    const original = getCardScript(REAL_CARD)!;
    expect(() => registerCardScript({ ...original, notes: "imposter" })).toThrow(DuplicateRegistrationError);
    expect(getCardScript(REAL_CARD)).toBe(original);
  });

  it("card scripts: the stored script is a frozen copy with normalized choice keys", () => {
    const shared = { chosen: true as const, cardType: "unit" as const };
    const script: CardScript = {
      name: "Registry Probe",
      text: "test",
      status: "implemented",
      abilities: [{ kind: "spell", effect: { op: "stun", target: shared } }],
    };
    const stored = registerCardScript(script);
    try {
      expect(stored).not.toBe(script);
      expect(Object.isFrozen(stored)).toBe(true);
      expect("targetRef" in shared).toBe(false);
      expect((stored.abilities[0] as { effect: { target: { targetRef?: string } } }).effect.target.targetRef).toBe("target:0");
    } finally {
      unregisterCardScript("Registry Probe");
    }
  });

  it("card scripts: overrideCardScript replaces and restores", () => {
    const original = getCardScript(REAL_CARD)!;
    const restore = overrideCardScript({ ...original, notes: "test-local" });
    expect(getCardScript(REAL_CARD)?.notes).toBe("test-local");
    restore();
    expect(getCardScript(REAL_CARD)).toBe(original);
  });

  it("custom conditions and effects", () => {
    expect(() => registerCustomCondition("did", () => true)).toThrow(DuplicateRegistrationError);
    expect(() => registerCustomEffect("sfd:draw-ref", () => ({ status: "resolved" }) as never)).toThrow(DuplicateRegistrationError);
    const restoreCondition = overrideCustomCondition("did", () => true);
    const restoreEffect = overrideCustomEffect("sfd:draw-ref", () => ({ status: "resolved" }) as never);
    restoreCondition();
    restoreEffect();
  });

  it("effect ops, prompt handlers and task handlers", () => {
    const op = getEffectOp("draw")!;
    expect(() => registerEffectOp("draw", op)).toThrow(DuplicateRegistrationError);
    const restoreOp = overrideEffectOp("draw", op);
    restoreOp();
    expect(getEffectOp("draw")).toBe(op);

    const prompt = getPromptHandler("stage_showdown")!;
    expect(() => registerPromptHandler("stage_showdown", prompt)).toThrow(DuplicateRegistrationError);
    overridePromptHandler("stage_showdown", prompt)();

    const task = getTaskHandler("combat")!;
    expect(task).toBeTypeOf("function");
    expect(() => registerTaskHandler("combat", task)).toThrow(DuplicateRegistrationError);
    overrideTaskHandler("combat", task)();
  });

  it("per-card additional costs", () => {
    const spec = [{ id: "probe", optional: true, cost: { energy: 1 }, rule: "204.2" as const }];
    const off = registerAdditionalCosts("Registry Probe Card", spec);
    expect(() => registerAdditionalCosts("Registry Probe Card", spec)).toThrow(DuplicateRegistrationError);
    off();
    overrideAdditionalCosts("Registry Probe Card", spec)();
  });

  it("ordered extension points reject the same function twice", () => {
    const interceptor: ActionInterceptor = (_room, _step, proposal) => proposal;
    const offInterceptor = registerActionInterceptor(interceptor);
    expect(() => registerActionInterceptor(interceptor)).toThrow(DuplicateRegistrationError);
    offInterceptor();
    const permission = () => null;
    const offPermission = registerPlayPermission(permission);
    expect(() => registerPlayPermission(permission)).toThrow(DuplicateRegistrationError);
    offPermission();
    const filter = () => true;
    const offFilter = registerCombatContributionFilter(filter);
    expect(() => registerCombatContributionFilter(filter)).toThrow(DuplicateRegistrationError);
    offFilter();
  });
});
