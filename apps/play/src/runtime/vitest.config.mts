/**
 * Inline vitest config for the play client runtime (task B11).
 *
 * apps/play has no vitest dependency (workspace rule: do not add deps), so run from the repo root
 * with the hoisted store binary:
 *
 *   pnpm --filter play typecheck
 *   cd apps/play/src/runtime && node <repo-root>/node_modules/.pnpm/vitest@<version>/node_modules/vitest/vitest.mjs run
 *
 * The config intentionally avoids importing `vitest/config` (not resolvable from apps/play) and
 * exports a plain options object instead.
 */
export default {
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.mts"],
    globals: false,
    passWithNoTests: true,
  },
};
