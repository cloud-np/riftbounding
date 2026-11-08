import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  clearPropertyScripts,
  registerPropertyScripts,
  runScenarioJson,
  runSequence,
} from "./generators";

beforeAll(() => registerPropertyScripts());
afterAll(() => clearPropertyScripts());

describe("property invariants [R307–R313]", () => {
  it(
    "[R312][R313.5][R321] random legal intents preserve timing, focus, cleanup and JSON invariants",
    () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 2 ** 30 }), (seed) => {
          const problem = runSequence(seed);
          expect(problem, `seed ${seed}: ${problem}`).toBeNull();
        }),
        { numRuns: 50 },
      );
    },
    180_000,
  );

  it(
    "[R312][R411.2] every listed intent is accepted and explainIllegal agrees with applyRulesIntent",
    () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 2 ** 30 }), (seed) => {
          const problem = runSequence(seed);
          expect(problem, `seed ${seed}: ${problem}`).toBeNull();
        }),
        { numRuns: 50 },
      );
    },
    180_000,
  );

  it("[R303.2] the same state + intent + seed always yields the same room", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 30 }), (seed) => {
        const first = runScenarioJson(seed);
        const second = runScenarioJson(seed);
        expect(second).toBe(first);
      }),
      { numRuns: 12 },
    );
  });
});
