/** `rules_manual_done` payload shape — contract §6.4. No payload fields. */
import type { WireValidator } from "./shared";

export const validateManualIntent: WireValidator = () => null;
