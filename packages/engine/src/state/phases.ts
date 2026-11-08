/**
 * Setup-phase routing.
 *
 *  - sealed / BO3 game 2+ → sideboarding
 *  - otherwise:
 *      - battlefield policy `all_except_first_player` (FFA4 / 2v2) → first-player
 *        initiative/choice happens BEFORE battlefields
 *      - `every_player` (duel / FFA3) → battlefields first, then initiative/choice
 *
 * Matches the setup state machine and the log catalogue (`choseStarterBattlefields`,
 * `battlefieldsLockedRollD20`, …).
 */
import type { Room } from "@rift/protocol";
import { VARIANT_RULES, variantForPlayerCount } from "./variant";

export function phaseAfterSideboarding(
  room: Pick<Room, "gameVariant" | "players" | "roomMode">,
): Room["phase"] {
  const variant = variantForPlayerCount(room.gameVariant, room.players.length);
  const policy = VARIANT_RULES[variant].battlefieldContributorPolicy;
  if (policy === "all_except_first_player") {
    return room.roomMode === "multiplayer" ? "initiative_roll" : "first_player_choice";
  }
  return "battlefield_pick";
}

export function firstSetupPhase(
  room: Pick<Room, "gameVariant" | "players" | "roomMode"> & {
    playMode?: Room["playMode"];
    matchFormat?: Room["matchFormat"];
    gameNumber?: number;
  },
): Room["phase"] {
  if (room.playMode === "sealed" || (room.matchFormat === "bo3" && (room.gameNumber ?? 1) > 1)) {
    return "sideboarding";
  }
  return phaseAfterSideboarding(room);
}
