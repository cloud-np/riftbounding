/**
 * CLI: count player decisions and automatic actions per self-play game, before/after auto-pass.
 *
 *   pnpm --filter @rift/rules interactions
 *
 * Environment: SELFPLAY_GAMES (50), SELFPLAY_SEED_START (1), SELFPLAY_DECK (`fixture` |
 * `catalog`), SELFPLAY_MAX_TURNS (80), SELFPLAY_MAX_ACTIONS (4000), INTERACTIONS_MODES
 * (comma list of `none`, `default`, `all`; default all three).
 *
 * Not a `*.test.ts` file: it runs under its own vitest config and is excluded from the suite.
 */
import { it } from "vitest";
import type { AutoPassPrefs } from "@rift/protocol";
import { DEFAULT_AUTO_PASS } from "../../src";
import { countInteractions, DECISION_CATEGORIES, REMOVED_BY, type InteractionTally } from "./interactions";

const MODES: Record<string, AutoPassPrefs | undefined> = {
  none: undefined,
  default: { ...DEFAULT_AUTO_PASS },
  all: { ownItems: true, responses: "no_response", forcedPrompts: "all", endTurn: "no_action", hold: false },
};

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function avg(values: readonly number[]): string {
  return (values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)).toFixed(2);
}

function sumKeys(tallies: readonly InteractionTally[], pick: (tally: InteractionTally) => Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const tally of tallies) for (const [key, value] of Object.entries(pick(tally))) out[key] = (out[key] ?? 0) + value;
  return out;
}

it("counts strict decisions per game with and without auto-pass", () => {
  const games = Math.max(1, numberFromEnv("SELFPLAY_GAMES", 50));
  const start = numberFromEnv("SELFPLAY_SEED_START", 1);
  const maxTurns = Math.max(1, numberFromEnv("SELFPLAY_MAX_TURNS", 80));
  const maxActions = Math.max(1, numberFromEnv("SELFPLAY_MAX_ACTIONS", 4000));
  const deckMode = process.env.SELFPLAY_DECK === "catalog" ? "catalog" : "fixture";
  const modes = (process.env.INTERACTIONS_MODES ?? "none,default,all").split(",").map((mode) => mode.trim()).filter((mode) => mode in MODES);

  console.log("");
  console.log(`interactions: ${games} game(s), seeds ${start}..${start + games - 1}, deckMode=${deckMode}`);
  for (const mode of modes) {
    const tallies: InteractionTally[] = [];
    for (let offset = 0; offset < games; offset += 1) {
      tallies.push(countInteractions(start + offset, { maxTurns, maxActions, deckMode, ...(MODES[mode] ? { autoPass: MODES[mode] } : {}) }));
    }
    const outcomes = sumKeys(tallies, (tally) => ({ [tally.outcome]: 1 }));
    console.log("");
    console.log(`mode=${mode} outcomes ${JSON.stringify(outcomes)} avg turns ${avg(tallies.map((t) => t.turns))}`);
    console.log(`  decisions/game          ${avg(tallies.map((t) => t.decisions))}`);
    console.log(`  decisions/turn          ${avg(tallies.map((t) => t.decisions / Math.max(1, t.turns)))}`);
    console.log(`  longest pass run (avg)  ${avg(tallies.map((t) => t.longestPassRun))}`);
    for (const category of DECISION_CATEGORIES) {
      console.log(`  ${category.padEnd(28)}${avg(tallies.map((t) => t.byCategory[category]))}`);
    }
    if (mode === "none") {
      // Counterfactual on these very games: what each preference set would have taken over.
      for (const set of ["default", "all"] as const) {
        const removed = tallies.map((t) => REMOVED_BY[set].reduce((sum, key) => sum + t.byCategory[key], 0));
        const left = tallies.map((t, index) => t.decisions - removed[index]!);
        console.log(`  counterfactual ${set.padEnd(8)} removes ${avg(removed)} → ${avg(left)} decisions/game`);
      }
    }
    const auto = sumKeys(tallies, (tally) => tally.auto);
    for (const [key, value] of Object.entries(auto).sort()) console.log(`  ${key.padEnd(24)}${(value / games).toFixed(2)}`);
    const prompts = sumKeys(tallies, (tally) => tally.prompts);
    console.log(`  prompts: ${JSON.stringify(Object.fromEntries(Object.entries(prompts).map(([k, v]) => [k, +(v / games).toFixed(2)])))}`);
  }
  console.log("");
}, 3_600_000);
