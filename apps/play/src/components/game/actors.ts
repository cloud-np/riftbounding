/**
 * Actor routing for board intents — the same rules the local harness uses, applied to the live
 * authoritative room. Setup actions must be sent as the seat that still needs to act; gameplay
 * actions usually belong to the viewing seat (end-turn actions belong to the active player).
 */
import type { Room } from "@rift/protocol";

import type { GameActionIntent } from "@/components/board/slot-types";

export const SETUP_ACTION_TYPES: ReadonlySet<string> = new Set([
  "select_battlefield",
  "submit_mulligan",
  "roll_initiative",
  "choose_first_player",
  "choose_single_player_turn_order",
  "submit_sideboard",
  "request_sideboard_skip",
  "respond_sideboard_skip",
  "confirm_solo_setup",
  "auto_start_test_setup",
]);

const ACTIVE_PLAYER_ACTIONS: ReadonlySet<string> = new Set([
  "end_turn",
  "end_beginning_phase",
]);

export function seatedPlayerIds(room: Room): string[] {
  return room.players
    .filter((player) => !!player.board && !player.leftAt)
    .map((player) => player.id);
}

export function chooseIntentActor(
  intent: GameActionIntent,
  room: Room,
  viewerId: string,
  controlledPlayerIds: string[],
): string {
  const seated = seatedPlayerIds(room);
  const controlled = (controlledPlayerIds.length > 0 ? controlledPlayerIds : [viewerId]).filter(
    (id) => seated.includes(id) || seated.length === 0,
  );
  const candidates = controlled.length > 0 ? controlled : [viewerId];
  const firstControlled = (ids: string[]): string | undefined =>
    ids.find((id) => candidates.includes(id));

  if (intent.type === "auto_start_test_setup") {
    const host = room.hostPlayerId && candidates.includes(room.hostPlayerId)
      ? room.hostPlayerId
      : firstControlled(candidates);
    return host ?? viewerId;
  }
  if (ACTIVE_PLAYER_ACTIONS.has(intent.type) && room.activeTurnPlayerId) {
    if (candidates.includes(room.activeTurnPlayerId)) return room.activeTurnPlayerId;
  }

  let pending: string[] = [];
  switch (intent.type) {
    case "select_battlefield":
      pending = seated.filter((id) => {
        const player = room.players.find((candidate) => candidate.id === id);
        return player && !player.selectedBattlefield;
      });
      break;
    case "submit_mulligan": {
      const done = new Set(room.mulliganDonePlayerIds ?? []);
      pending = seated.filter((id) => !done.has(id));
      break;
    }
    case "roll_initiative": {
      const rolled = new Set(Object.keys(room.initiativeRolls ?? {}));
      pending = seated.filter((id) => !rolled.has(id));
      break;
    }
    case "submit_sideboard": {
      const done = new Set(room.sideboardDonePlayerIds ?? []);
      pending = seated.filter((id) => !done.has(id));
      break;
    }
    case "choose_first_player":
      pending = room.firstPlayerChooserId ? [room.firstPlayerChooserId] : [];
      break;
    default:
      break;
  }
  return firstControlled(pending) ?? (candidates.includes(viewerId) ? viewerId : candidates[0]) ?? viewerId;
}
