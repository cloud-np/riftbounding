/** Legal activated abilities — rules 376–381/403.3. */
import type { Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { activatableAbilities } from "../legality/activate";

export function legalActivatableAbilities(
  room: Room,
  playerId: string,
  host: RulesHost,
): Array<{ objectId: string; ability: string }> {
  return activatableAbilities(room, playerId, host);
}
