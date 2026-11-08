import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // The frozen-host smoke suite has its own config (`test:host`) so the regression counts
    // stay exactly the pre-refactor 17 files / 96 tests.
    exclude: ["**/node_modules/**", "**/dist/**", "test/host/**"],
  },
});
