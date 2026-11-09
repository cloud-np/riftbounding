import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Dedicated config for the `interactions` CLI (`pnpm --filter @rift/rules interactions`). */
export default defineConfig({
  test: {
    root: fileURLToPath(new URL("../..", import.meta.url)),
    include: ["test/bot/interactions.run.ts"],
    reporters: ["verbose"],
    silent: false,
    testTimeout: 3_600_000,
    hookTimeout: 3_600_000,
  },
});
