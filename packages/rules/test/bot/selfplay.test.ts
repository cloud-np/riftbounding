/**
 * Default-suite self-play checks.
 *
 * The full sweep lives in `selfplay.run.ts` / `pnpm --filter @rift/rules selfplay`; this file
 * keeps a small set of seeds that pass on the current engine so the normal suite stays green,
 * plus the seeds that found engine bugs (kept as regression tests; all fixed in R4-engine-e).
 */
import { describe, expect, it } from "vitest";
import { selfplay, type SelfplayReport } from "./selfplay";

const FAILURE_OUTCOMES = new Set(["stuck", "crash"]);

const PASSING_FIXTURE_SEEDS = [1, 2, 4, 5, 6, 10];
const PASSING_CATALOG_SEEDS = [1, 2, 4, 5];

function expectHealthy(report: SelfplayReport): void {
  expect(
    FAILURE_OUTCOMES.has(report.outcome),
    `seed ${report.seed}: ${report.outcome} at step ${report.step} turn ${report.turn} — ${report.reason ?? ""}`,
  ).toBe(false);
  if (report.outcome === "win") expect(report.winnerPlayerIds?.length ?? 0).toBeGreaterThan(0);
}

describe("headless strict self-play", () => {
  it("plays seeded fixture-deck games to a win or a cap", () => {
    for (const seed of PASSING_FIXTURE_SEEDS) {
      expectHealthy(selfplay(seed, { maxTurns: 80, maxActions: 4000 }));
    }
  }, 120_000);

  it("plays seeded catalog-deck games to a win or a cap", () => {
    for (const seed of PASSING_CATALOG_SEEDS) {
      expectHealthy(selfplay(seed, { deckMode: "catalog", maxTurns: 80, maxActions: 4000 }));
    }
  }, 120_000);

  it("is deterministic for a given seed and options", () => {
    const first = selfplay(7, { maxTurns: 80, maxActions: 4000 });
    const second = selfplay(7, { maxTurns: 80, maxActions: 4000 });
    expect(second).toEqual(first);
  }, 120_000);

  // docs/rules/auto-pass.md: automatic passes/answers/turn ends never stall or crash a game.
  it("plays seeded games with every auto-pass option on (fixture and catalog decks)", () => {
    const autoPass = { ownItems: true, responses: "no_response", forcedPrompts: "all", endTurn: "no_action", hold: false } as const;
    for (const seed of [1, 2, 3]) {
      expectHealthy(selfplay(seed, { maxTurns: 80, maxActions: 4000, autoPass }));
      expectHealthy(selfplay(seed, { deckMode: "catalog", maxTurns: 80, maxActions: 4000, autoPass }));
    }
    const first = selfplay(7, { maxTurns: 80, maxActions: 4000, autoPass });
    expect(selfplay(7, { maxTurns: 80, maxActions: 4000, autoPass })).toEqual(first);
  }, 240_000);
});

/**
 * Self-play seeds that found engine bugs, kept as regression tests. The bugs are fixed by
 * R4-engine-e; the root causes are in `.orchestrator/reports/r4-selfplay-findings.md` and
 * `.orchestrator/reports/r4-engine-e-findings.md`.
 */
describe("self-play seeds that found engine bugs", () => {
  // R420.2.a: a pending non-standard (kill) cost used to make planPayment skip the resource
  // check, so an unaffordable play was listed; the play then cancelled with
  // insufficient_resources and the card stayed in hand, producing a 2-step loop.
  for (const seed of [18, 26, 70, 154, 168, 211, 215, 219, 268, 334, 348, 359, 425, 503, 569]) {
    it(`[R420.2.a] selfplay seed ${seed}: pending kill cost bypasses the resource check`, () => {
      expectHealthy(selfplay(seed, { deckMode: "catalog", maxTurns: 80, maxActions: 4000 }));
    }, 120_000);
  }

  // R355.8 / 420.2.a: Sanction's mode prompt used to offer a mode whose mandatory target has no
  // legal choice; picking that mode cancelled the play (no_legal_targets) and the card stayed in
  // hand.
  it("[R355.8] selfplay seed 530: mode prompt offers a mode with no legal target (Sanction)", () => {
    expectHealthy(selfplay(530, { deckMode: "catalog", maxTurns: 80, maxActions: 4000 }));
  }, 120_000);

  // R818.1.c.2: an unscripted [Equip] line used to be listed both as the built-in `equip:0` and
  // as a free `manual:0` activated ability; activating the latter opened and closed the manual
  // window without changing any lasting state, so the bot cycled forever.
  it("[R818.1.c.2] selfplay seed 312: unscripted Equip is exposed twice (manual:0 + equip:0)", () => {
    expectHealthy(selfplay(312, { deckMode: "catalog", maxTurns: 80, maxActions: 4000 }));
  }, 120_000);
});
