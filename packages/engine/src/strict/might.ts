/**
 * Read-side effective Might for clients: the rules engine's single source of truth
 * (`effectiveMight`, 143.2.a / 479.4), bound to the engine host. Returns null outside a strict
 * in-game room or when the layer cannot evaluate the object (e.g. a redacted placeholder).
 */
import type { Room } from "@rift/protocol";
import { effectiveMight } from "@rift/rules";
import { createEngineRulesHost } from "./host";

export function strictEffectiveMight(room: Room | null | undefined, cardId: string): number | null {
  if (!room || room.rulesMode !== "strict" || room.phase !== "in_game" || !room.rules) return null;
  try {
    const host = createEngineRulesHost({
      now: room.updatedAt ?? 0,
      rng: () => 0,
      mode: room.roomMode ?? "multiplayer",
    });
    const value = effectiveMight(room, cardId, host);
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}
