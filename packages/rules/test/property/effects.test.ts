/**
 * R2-effects property: random legal intents with the production card scripts (triggers, targets
 * chosen on resolution/finalization, replacement and layer effects) keep the timing invariants,
 * view/write agreement and JSON round-tripping.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { assertInvariants, candidateIntents, checkAgreement, mulberry32 } from "./generators";
import { scenario } from "../scenarios/dsl";
import "./answerers/index";

function buildEffectsScenario(seed: number) {
  const s = scenario({
    seed,
    roomCode: `FX-${seed}`,
    p1: { hand: ["Whiteflame Protector", "En Garde", "Gust", "Stellacorn Herder", "Treasure Hunter"], energy: 20 },
    p2: { hand: ["Rebuke", "Defy", "Clockwork Keeper", "Reckless Innovator", "Caitlyn, Patrolling"], energy: 20 },
  });
  return s;
}

function runEffectsSequence(seed: number, steps = 45): string | null {
  const random = mulberry32(seed);
  const s = buildEffectsScenario(seed);
  for (let index = 0; index < steps; index += 1) {
    if (s.room.gameOutcome) break;
    const options = candidateIntents(s, random);
    if (options.length === 0) return `no intent at step ${index}`;
    const agreement = checkAgreement(s, seed, index);
    if (agreement) return `${agreement} at step ${index}`;
    const picked = options[Math.floor(random() * options.length)]!;
    s.as(picked.player).apply(picked.intent);
    const error = s.lastError();
    if (error) return `legal-looking ${picked.intent.type} rejected: ${error.code} (${error.rule}) at step ${index}`;
    const problem = assertInvariants(s.room);
    if (problem) return `${problem} at step ${index}`;
  }
  return null;
}

describe("effects property [R382][R403][R355.18]", () => {
  it(
    "[R382][R403][R355.18][R312] production scripts keep the timing invariants under random play",
    () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 2 ** 30 }), (seed) => {
          const problem = runEffectsSequence(seed);
          expect(problem, `seed ${seed}: ${problem}`).toBeNull();
        }),
        { numRuns: 30 },
      );
    },
    180_000,
  );
});
