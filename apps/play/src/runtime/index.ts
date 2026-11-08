/**
 * `@/runtime` — public entry point for the play client runtime (task B11).
 *
 * Wave-2 UI agents: import from `@/runtime` only. See `apps/play/src/runtime/README.md`.
 */

export * from "./config";
export * from "./auth";
export * from "./roomApi";
export * from "./socket";
export * from "./store";
export * from "./presence";
export * from "./settings";
export * from "./sound";
export * from "./deriveActionSound";
export * from "./patch";
export * from "./matchRuntime";
export * from "./matchmaking";
export * from "./decks";
export * from "./hooks";
export { applyRuntimePatch as applyRuntimePatchDirect } from "./adapters/sync";
export {
  applyGameActionOptimistic,
  hasEngineApply,
  ENGINE_NOT_READY,
  type EngineActionContext,
  type EngineApplyResult,
} from "./adapters/engine";
export { hasSyncPackagePatchApply } from "./adapters/sync";
