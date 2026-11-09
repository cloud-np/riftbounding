/**
 * CLI entry for the headless self-play harness — run with:
 *
 *   pnpm --filter @rift/rules selfplay
 *
 * Environment:
 *   SELFPLAY_GAMES        number of seeded games (default 50)
 *   SELFPLAY_SEED_START   first seed (default 1)
 *   SELFPLAY_MAX_TURNS    per-game turn cap (default 80)
 *   SELFPLAY_MAX_ACTIONS  per-game action cap (default 4000)
 *   SELFPLAY_DECK         `fixture` (default) or `catalog` (random Calm/Chaos decks)
 *   SELFPLAY_AUTOPASS     `none` (default), `default` or `all` (docs/rules/auto-pass.md)
 *
 * This file is intentionally not named `*.test.ts`: it is excluded from the default suite via
 * its own vitest config and is meant to be run on demand.
 */
import { it } from "vitest";
import type { AutoPassPrefs } from "@rift/protocol";
import { DEFAULT_AUTO_PASS } from "../../src";
import { selfplay, type SelfplayOutcome, type SelfplayReport } from "./selfplay";

const OUTCOMES: SelfplayOutcome[] = ["win", "turn_cap", "action_cap", "stuck", "crash"];

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function truncate(value: string, length: number): string {
  return value.length <= length ? value : `${value.slice(0, length - 1)}…`;
}

function detail(report: SelfplayReport): string {
  if (report.reject) {
    return `REJECT ${report.reject.code} (${report.reject.rule})${report.reject.detail ? `: ${report.reject.detail}` : ""}`;
  }
  return report.reason ?? "";
}

function summaryLine(label: string, value: string | number): string {
  return `${label.padEnd(18)} ${value}`;
}

it("runs seeded strict self-play games and prints a summary", () => {
  const games = Math.max(1, numberFromEnv("SELFPLAY_GAMES", 50));
  const start = numberFromEnv("SELFPLAY_SEED_START", 1);
  const maxTurns = Math.max(1, numberFromEnv("SELFPLAY_MAX_TURNS", 80));
  const maxActions = Math.max(1, numberFromEnv("SELFPLAY_MAX_ACTIONS", 4000));
  const deckMode = process.env.SELFPLAY_DECK === "catalog" ? "catalog" : "fixture";
  // docs/rules/auto-pass.md: `default` seeds the information-safe defaults, `all` every option.
  const autoPassMode = process.env.SELFPLAY_AUTOPASS ?? "none";
  const autoPass: AutoPassPrefs | undefined =
    autoPassMode === "default"
      ? { ...DEFAULT_AUTO_PASS }
      : autoPassMode === "all"
        ? { ownItems: true, responses: "no_response", forcedPrompts: "all", endTurn: "no_action", hold: false }
        : undefined;

  const reports: SelfplayReport[] = [];
  const failures: SelfplayReport[] = [];
  for (let offset = 0; offset < games; offset += 1) {
    const seed = start + offset;
    const report = selfplay(seed, { maxTurns, maxActions, deckMode, ...(autoPass ? { autoPass } : {}) });
    reports.push(report);
    if (report.outcome === "stuck" || report.outcome === "crash") failures.push(report);
  }

  console.log("");
  console.log(`selfplay: ${games} game(s), seeds ${start}..${start + games - 1}, deckMode=${deckMode}, autoPass=${autoPassMode}, maxTurns=${maxTurns}, maxActions=${maxActions}`);
  console.log("");
  console.log("seed | outcome    | steps | turns | result");
  console.log("-----+------------+-------+-------+------------------------------------------");
  for (const report of reports) {
    const result =
      report.outcome === "win"
        ? `winner ${report.winnerPlayerIds?.join(",") ?? "?"} score ${JSON.stringify(report.scores ?? {})}`
        : truncate(detail(report), 90);
    console.log(
      `${String(report.seed).padStart(4)} | ${report.outcome.padEnd(10)} | ${String(report.step).padStart(5)} | ${String(report.turn).padStart(5)} | ${result}`,
    );
  }

  console.log("");
  const counts = Object.fromEntries(OUTCOMES.map((outcome) => [outcome, 0])) as Record<SelfplayOutcome, number>;
  for (const report of reports) counts[report.outcome] += 1;
  const totalTurns = reports.reduce((sum, report) => sum + report.turn, 0);
  const wins = reports.filter((report) => report.outcome === "win");
  const winTurns = wins.reduce((sum, report) => sum + report.turn, 0);
  console.log("summary");
  console.log(summaryLine("games", reports.length));
  console.log(summaryLine("wins", counts.win));
  console.log(summaryLine("turn caps", counts.turn_cap));
  console.log(summaryLine("action caps", counts.action_cap));
  console.log(summaryLine("stuck", counts.stuck));
  console.log(summaryLine("crashes", counts.crash));
  console.log(summaryLine("avg turns (all)", (totalTurns / Math.max(1, reports.length)).toFixed(2)));
  console.log(summaryLine("avg turns (wins)", (winTurns / Math.max(1, wins.length)).toFixed(2)));

  if (failures.length > 0) {
    console.log("");
    console.log(`failures (${failures.length})`);
    for (const report of failures) {
      console.log(
        `seed ${report.seed}: ${report.outcome} at step ${report.step} turn ${report.turn}` +
          `${report.actor ? ` actor ${report.actor}` : ""}${report.intent ? ` intent ${JSON.stringify(report.intent)}` : ""}` +
          ` — ${detail(report)}`,
      );
      console.log(
        `  state: ${JSON.stringify({ winnerPlayerIds: report.winnerPlayerIds, scores: report.scores })}`,
      );
      console.log(
        `  last events: ${JSON.stringify(report.lastEvents.map((event) => ({ type: event.type, playerId: event.playerId, data: event.data })))}`,
      );
    }
  }
  console.log("");
}, 3_600_000);
