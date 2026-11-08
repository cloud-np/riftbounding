/**
 * @rift/protocol — strict-rules layer wire/state types (additive).
 *
 * Compatibility barrel. The definitions moved 1:1 into `./rules/` so wave R2 agents can extend
 * their own domain file without conflicts (see `./rules/domains/*`). Export names and shapes
 * are unchanged; this is a layout-only change with no wire impact.
 */

export * from "./rules";
