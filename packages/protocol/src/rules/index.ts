/**
 * @rift/protocol — strict-rules wire/state types (additive), split by ownership.
 *
 * `rules-state.ts` (the historical single file) is now a pure barrel over this directory.
 * Every exported name and shape from R1 is preserved; this is a layout-only change.
 *
 * Extension surface for wave R2 (`./domains/*`):
 *   - `play.ts`    — R2-play (process of play, costs, payment, targets, activate, move)
 *   - `combat.ts`  — R2-combat (461–468, damage assignment, scoring, victory)
 *   - `effects.ts` — R2-effects (Effect DSL, triggers, replacements, layers, card scripts)
 *   - `int.ts`     — R2-int (sync redaction, realtime, apps/play strict UI)
 *
 * `core.ts` composes each domain hook into the exported unions/intersections, so the four
 * agents never edit the same file.
 */
export * from "./core";
export * from "./effects";
export * from "./ability";
export * from "./cost";
export * from "./intents";
export * from "./domains/play";
export * from "./domains/combat";
export * from "./domains/effects";
export * from "./domains/int";
