/**
 * Primitive game actions — rules 412–448, 469–474 (compatibility barrel).
 *
 * The implementation moved 1:1 into per-domain files so wave R2 agents can extend their own
 * domain without editing a shared file. `export *` keeps every existing name and the
 * `primitives` namespace identical.
 */
export * from "./ready";
export * from "./draw";
export * from "./damage";
export * from "./move";
export * from "./resources";
export * from "./score";
export * from "./control";
export * from "./tokens";

export type { GameEvent } from "@rift/protocol";
