/// <reference types="vite/client" />
/**
 * Auto-discovered declarative scenarios (docs/rules/scenarios.md).
 *
 * Every `tournament/**\/*.scenario.ts` / `regressions/**\/*.scenario.ts` (default export) and
 * `*.scenario.json` file becomes one
 * test. A scenario marked `expectFailure` passes while the engine still diverges (XFAIL) and fails
 * once it unexpectedly passes (XPASS), so a fixed divergence is noticed.
 */
import { describe, expect, it } from "vitest";
import type { ScenarioSpec } from "./format";
import { assertScenarioResult, runScenario } from "./runner";

// `tournament/`: scenarios from tournament play; `regressions/`: scenarios converted from
// play-test repros (`pnpm --filter @rift/rules scenario convert`).
const modules = import.meta.glob<{ default: ScenarioSpec }>(
  ["./tournament/**/*.scenario.ts", "./regressions/**/*.scenario.ts"],
  { eager: true },
);
const json = import.meta.glob<ScenarioSpec>(
  ["./tournament/**/*.scenario.json", "./regressions/**/*.scenario.json"],
  { eager: true, import: "default" },
);

const scenarios: Array<[string, ScenarioSpec]> = [
  ...Object.entries(modules).map(
    ([file, module]) => [file, module.default] as [string, ScenarioSpec],
  ),
  ...Object.entries(json),
].sort(([a], [b]) => a.localeCompare(b));

describe("declarative scenarios", () => {
  it("discovers the scenario files", () => {
    expect(scenarios.length).toBeGreaterThan(0);
    for (const [file, spec] of scenarios)
      expect(spec, `${file} has no default export`).toBeTruthy();
  });

  for (const [file, spec] of scenarios) {
    const tag = spec.expectFailure ? " (expected failure)" : "";
    it(`[${spec.verification}] ${spec.title}${tag} — ${file.replace("./", "")}`, () => {
      // Every tournament scenario must say where it comes from (integrity rule).
      expect(spec.sources?.length ?? 0, `${file}: cite at least one source`).toBeGreaterThan(0);
      assertScenarioResult(runScenario(spec, { file }));
    });
  }
});
