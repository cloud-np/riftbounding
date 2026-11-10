#!/usr/bin/env node
/**
 * Declarative scenario CLI (docs/rules/scenarios.md):
 *
 *   pnpm --filter @rift/rules scenario [run] <file-or-dir>... [--quiet]
 *   pnpm --filter @rift/rules scenario convert <repro.json> --at <index> [--count <n>] [--out <file>]
 *
 * `run` executes scenarios against the real strict engine and prints a step-by-step trace;
 * exit code 1 when a scenario fails (or an expected failure unexpectedly passes).
 * `convert` turns an exported strict repro into a scenario skeleton.
 *
 * Relative paths resolve against the directory pnpm was invoked from (INIT_CWD).
 */
import path from "node:path";
import { createServer } from "vite";

const root = path.resolve(import.meta.dirname, "..");
const server = await createServer({
  root,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true, hmr: false },
});

try {
  const { main } = await server.ssrLoadModule("/test/scenarios/cli.ts");
  process.exitCode = await main(process.argv.slice(2), {
    cwd: process.env.INIT_CWD ?? process.cwd(),
    packageRoot: root,
    load: (file) => server.ssrLoadModule(file),
  });
} catch (error) {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 2;
} finally {
  await server.close();
}
