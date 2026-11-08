/** Who may act — rules 312/313/411.2/§6.4. */
import type { Room, WhoMayAct } from "@rift/protocol";

/** 312/313/411.2/§6.4: exactly one actor at a time (or nobody). */
export function whoMayAct(room: Room): WhoMayAct {
  const rules = room.rules;
  if (!rules || room.gameOutcome) return { kind: "none" };
  if (rules.prompt) return { kind: "prompt", player: rules.prompt.playerId, window: "prompt" };
  if (rules.manual) return { kind: "manual", player: rules.manual.player, window: "manual" };
  if (rules.chain.length > 0) {
    if (rules.priority) return { kind: "priority", player: rules.priority, window: "chain" };
    return { kind: "none" };
  }
  if (rules.showdown && rules.focus) {
    return { kind: "focus", player: rules.focus, window: "showdown" };
  }
  if (rules.priority) {
    return { kind: "priority", player: rules.priority, window: rules.turn.phase === "main" ? "main" : "chain" };
  }
  return { kind: "none" };
}
