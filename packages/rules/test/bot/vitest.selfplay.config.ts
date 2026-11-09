import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Dedicated config for the `selfplay` CLI (`pnpm --filter @rift/rules selfplay`).
 * The runner is not a `*.test.ts` file so the default suite never runs dozens of games.
 */
export default defineConfig({
  test: {
    root: fileURLToPath(new URL("../..", import.meta.url)),
    include: ["test/bot/selfplay.run.ts"],
    reporters: ["verbose"],
    silent: false,
    testTimeout: 3_600_000,
    hookTimeout: 3_600_000,
  },
});
