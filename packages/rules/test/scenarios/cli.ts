/**
 * Scenario CLI implementation, loaded by `scripts/scenario.mjs` through vite SSR (so scenario
 * files stay plain TypeScript). See docs/rules/scenarios.md.
 */
import fs from "node:fs";
import path from "node:path";
import type { StrictReproFile } from "@rift/protocol";
import type { ScenarioSpec } from "./format";
import { explainResult, runScenario, type ScenarioResult } from "./runner";
import { convertRepro, reproIndices, scenarioSource } from "./convert";
import { makeBotRepro } from "./repro-fixture";
import { validateScenario } from "./validate";

export interface CliHost {
  cwd: string;
  packageRoot: string;
  load: (file: string) => Promise<Record<string, unknown>>;
}

const USAGE = `usage:
  pnpm --filter @rift/rules scenario [run] <file-or-dir>... [--quiet]
  pnpm --filter @rift/rules scenario convert <repro.json> --at list
  pnpm --filter @rift/rules scenario convert <repro.json> --at <index> [--count <n>] [--out <file>] [--title <text>]
  pnpm --filter @rift/rules scenario make-repro --out <repro.json> [--actions <n>] [--seed <n>]`;

export function isScenarioFile(file: string): boolean {
  return /\.scenario\.(ts|json)$/.test(file);
}

/** Every `*.scenario.ts|json` below `target` (or `target` itself), sorted. */
export function collectScenarioFiles(target: string): string[] {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  const out: string[] = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) out.push(...collectScenarioFiles(full));
    else if (isScenarioFile(entry.name)) out.push(full);
  }
  return out.sort();
}

function resolveInput(host: CliHost, input: string): string {
  const candidates = [path.resolve(host.cwd, input), path.resolve(host.packageRoot, input)];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`no such file or directory: ${input}`);
  return found;
}

export async function loadScenario(host: CliHost, file: string): Promise<ScenarioSpec> {
  if (file.endsWith(".json")) return JSON.parse(fs.readFileSync(file, "utf8")) as ScenarioSpec;
  const module = await host.load(file);
  const spec = (module.default ?? module.scenario) as ScenarioSpec | undefined;
  if (!spec)
    throw new Error(`${file} has no default export (export default defineScenario({...}))`);
  return spec;
}

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
}

async function runCommand(host: CliHost, args: string[]): Promise<number> {
  const quiet = args.includes("--quiet");
  const targets = args.filter((arg) => !arg.startsWith("--"));
  if (targets.length === 0) {
    console.error(USAGE);
    return 2;
  }
  const files = targets.flatMap((target) => collectScenarioFiles(resolveInput(host, target)));
  if (files.length === 0) {
    console.error("no *.scenario.ts / *.scenario.json files found");
    return 2;
  }
  const results: ScenarioResult[] = [];
  for (const file of files) {
    const relative = path.relative(host.packageRoot, file);
    let result: ScenarioResult;
    try {
      const spec = await loadScenario(host, file);
      const problems = validateScenario(spec);
      if (problems.length > 0) throw new Error(`invalid scenario:\n  - ${problems.join("\n  - ")}`);
      result = runScenario(spec, { file: relative });
    } catch (error) {
      result = {
        title: path.basename(file),
        file: relative,
        verification: "illustrative",
        status: "fail",
        failure: { step: 0, label: "load", message: (error as Error).message, diffs: [] },
        trace: [],
        warnings: [],
        steps: 0,
        engineCalls: 0,
      };
    }
    results.push(result);
    const tag = result.status.toUpperCase().padEnd(5);
    console.log(`\n${tag} ${result.title}  [${result.verification}]  ${relative}`);
    if (!quiet || result.status === "fail" || result.status === "xpass") {
      for (const line of result.trace) console.log(line);
    }
    for (const warning of result.warnings) console.log(`  warning: ${warning}`);
    if (result.status !== "pass") console.log(`  ${explainResult(result).split("\n")[0]}`);
  }
  const count = (status: ScenarioResult["status"]) =>
    results.filter((result) => result.status === status).length;
  const steps = results.reduce((sum, result) => sum + result.steps, 0);
  const calls = results.reduce((sum, result) => sum + result.engineCalls, 0);
  console.log(
    `\n${results.length} scenario(s): ${count("pass")} passed, ${count("xfail")} expected failure(s), ${count("fail")} failed, ${count("xpass")} unexpectedly passed (${steps} steps, ${calls} engine calls)`,
  );
  return count("fail") + count("xpass") > 0 ? 1 : 0;
}

async function convertCommand(host: CliHost, args: string[]): Promise<number> {
  const at = flag(args, "--at");
  const count = flag(args, "--count");
  const out = flag(args, "--out");
  const title = flag(args, "--title");
  const input = args.find((arg) => !arg.startsWith("--"));
  if (!input || at === undefined) {
    console.error(USAGE);
    return 2;
  }
  const file = resolveInput(host, input);
  const repro = JSON.parse(fs.readFileSync(file, "utf8")) as StrictReproFile;
  if (at === "list") {
    console.log(
      `${repro.actions.length} action(s) in ${path.basename(file)}; a position can start before any "clean" index:`,
    );
    for (const info of reproIndices(repro)) {
      console.log(
        `  ${String(info.index).padStart(4)}  turn ${String(info.turn).padStart(2)} (${info.player ?? "?"})  ${info.clean ? "clean" : "     "}  ${info.actor ?? "?"} ${info.action}`,
      );
    }
    return 0;
  }
  const converted = convertRepro(repro, {
    at: Number(at),
    ...(count !== undefined ? { count: Number(count) } : {}),
    ...(title ? { title } : {}),
    sourceFile: path.basename(file),
  });
  const target = out ? path.resolve(host.cwd, out) : null;
  let formatImport = "../format";
  if (target) {
    const relative = path
      .relative(path.dirname(target), path.join(host.packageRoot, "test/scenarios/format"))
      .split(path.sep)
      .join("/");
    formatImport = relative.startsWith(".") ? relative : `./${relative}`;
  }
  const source = scenarioSource(converted.spec, converted.warnings, formatImport);
  if (target) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source);
    console.log(`wrote ${target} (${converted.spec.steps.length} step(s))`);
  } else {
    process.stdout.write(source);
  }
  for (const warning of converted.warnings) console.error(`warning: ${warning}`);
  return 0;
}

/** A headless Practice-vs-Bot repro (same format as the UI's "Export repro"). */
function makeReproCommand(host: CliHost, args: string[]): number {
  const out = flag(args, "--out");
  const actions = flag(args, "--actions");
  const seed = flag(args, "--seed");
  if (!out) {
    console.error(USAGE);
    return 2;
  }
  const repro = makeBotRepro({
    ...(actions !== undefined ? { actions: Number(actions) } : {}),
    ...(seed !== undefined ? { seed: Number(seed) } : {}),
  });
  const target = path.resolve(host.cwd, out);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(repro, null, 2)}\n`);
  console.log(`wrote ${target} (${repro.actions.length} action(s), final hash ${repro.finalHash})`);
  return 0;
}

export async function main(argv: string[], host: CliHost): Promise<number> {
  const args = [...argv];
  if (args[0] === "--") args.shift();
  const command = ["convert", "run", "make-repro"].includes(args[0] ?? "") ? args.shift()! : "run";
  if (args.includes("--help") || args.includes("-h")) {
    console.log(USAGE);
    return 0;
  }
  if (command === "convert") return convertCommand(host, args);
  if (command === "make-repro") return makeReproCommand(host, args);
  return runCommand(host, args);
}
