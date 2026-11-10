/**
 * Deterministic `RulesContext` shared by the fluent DSL (`dsl.ts`) and the declarative scenario
 * runner. Kept free of `vitest` imports so the scenario CLI can load it outside a test run.
 */
import type { RulesContext } from "../../src";

export function deterministicContext(seed = 123456789): RulesContext {
  let state = seed >>> 0;
  return {
    now: 1_760_000_000_000,
    rng: () => {
      state = (1664525 * state + 0x3c6ef35f) >>> 0;
      return state / 0x100000000;
    },
    mode: "multiplayer",
  };
}
