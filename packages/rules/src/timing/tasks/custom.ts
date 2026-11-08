/**
 * Custom task — rule 333 extension point for R2 effects/triggers.
 *
 * R1 ignores custom tasks exactly as before; R2 registers a handler for its own task kinds
 * (`registerTaskHandler("custom", …)` or a new protocol `TaskKind`).
 */
import { registerTaskHandler } from "./registry";

registerTaskHandler("custom", () => "continue");
