/**
 * Compatibility barrel — the read side moved 1:1 into `./view/` (R1-SPLIT-R).
 * `promptFor` lives here because it is a pure convenience over `RulesState.prompt`.
 */
import type { Prompt, Room } from "@rift/protocol";

export * from "./view/index";

/** Convenience for prompt UIs. */
export function promptFor(room: Room, playerId: string): Prompt | null {
  return room.rules?.prompt?.playerId === playerId ? room.rules.prompt : null;
}

export type { LegalMove, RulesIntent } from "@rift/protocol";
