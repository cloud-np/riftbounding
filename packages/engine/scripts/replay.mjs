#!/usr/bin/env node
/**
 * Replay a strict repro file through the real engine:
 *
 *   pnpm --filter @rift/engine replay path/to/repro.json
 *
 * Exits 1 on the first rejected action or step/final hash mismatch, printing the step index.
 */
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const file = process.argv[2];
if (!file) {
  console.error("usage: pnpm --filter @rift/engine replay <repro.json>");
  process.exit(2);
}

const root = path.resolve(import.meta.dirname, "..");
const server = await createServer({
  root,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { replayStrictRepro } = await server.ssrLoadModule("/src/strict/repro.ts");
  const repro = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  const result = replayStrictRepro(repro);
  if (!result.ok) {
    const failure = result.failure;
    console.error(
      `repro failed at step ${failure.step}: ${failure.reason}: ${failure.message}`,
    );
    if (failure.expectedHash) console.error(`  expected hash ${failure.expectedHash}`);
    if (failure.actualHash) console.error(`  actual hash   ${failure.actualHash}`);
    process.exitCode = 1;
  } else {
    console.log(
      `repro ok: ${result.steps} action(s), ${result.room.roomCode}, hash ${result.hash}`,
    );
  }
} finally {
  await server.close();
}
