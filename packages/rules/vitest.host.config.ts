import { defineConfig } from "vitest/config";

/**
 * Host smoke suite (R1-SPLIT-R). Kept out of the default `vitest run` so the strict-rules
 * regression count stays exactly the pre-refactor 96; run it explicitly with:
 *   pnpm --filter @rift/rules test:host
 */
export default defineConfig({
  test: {
    include: ["test/host/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
