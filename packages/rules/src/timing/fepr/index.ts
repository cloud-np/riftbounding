/**
 * HOT FEPR barrel — rules 333–340.
 *
 * Finalize (337) → Execute (338) → Pass (339) → Resolve (340). The implementation is split per
 * domain so wave R2 agents extend only their own file.
 */
export * from "./chain";
export * from "./finalize";
export * from "./resolve";
export * from "./pass";
export * from "./after";
export * from "./manual";
export * from "./spell";
