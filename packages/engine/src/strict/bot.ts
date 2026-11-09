// R4 bot-room stand-in: replaced by the bot-core lane at integration
/**
 * Engine binding for the strict bot picker: `@rift/rules` needs a `RulesHost` because board
 * facts live in `Room`; this binds the engine host and forwards the injected RNG.
 */
import type { Room, RulesIntent } from "@rift/protocol";
import { pickRandomAction, type RulesContext } from "@rift/rules";
import { createEngineRulesHost } from "./host";

export function pickStrictBotAction(
  room: Room,
  playerId: string,
  random: () => number,
): RulesIntent | null {
  const ctx: RulesContext = {
    now: room.updatedAt ?? 0,
    rng: random,
    mode: room.roomMode ?? "multiplayer",
  };
  return pickRandomAction(room, playerId, createEngineRulesHost(ctx), random);
}
