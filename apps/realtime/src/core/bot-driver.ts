/**
 * Practice-bot driver helpers (R4 bot-room).
 *
 * The bot only ever sees its own per-viewer redacted room (128.4): the same projection a
 * connected client would receive. The picker itself lives in `@rift/rules` and is bound to the
 * engine host by `pickStrictBotAction`.
 */
import { pickStrictBotAction, strictWhoMayAct } from "@rift/engine";
import type { WhoMayAct, Room, RulesIntent } from "@rift/protocol";
import { redactRoomForViewer } from "@rift/sync";

/** Hard bound on bot actions per driver wake so a stuck bot cannot starve the room. */
export const BOT_ACTION_CAP = 64;

/** Bot seats that are still active, in seat order. */
export function botPlayerIds(room: Room): string[] {
  return room.players
    .filter((player) => player.isBot === true && !player.leftAt)
    .slice()
    .sort((a, b) => a.seat - b.seat)
    .map((player) => player.id);
}

export function isBotSeat(room: Room, playerId: string): boolean {
  return botPlayerIds(room).includes(playerId);
}

/** The bot's own redacted view — never the authoritative room. */
export function botRedactedView(room: Room, botId: string): Room {
  return redactRoomForViewer(room, { playerId: botId, viewerRole: "player" });
}

/** Compute the next bot intent on the bot's redacted view (null when it is not this bot's turn). */
export function nextBotIntent(room: Room, botId: string, random: () => number): RulesIntent | null {
  return pickStrictBotAction(botRedactedView(room, botId), botId, random);
}

/** The bot's own view of who may act (used only for diagnostics on a stuck pick). */
export function botMayAct(room: Room, botId: string): WhoMayAct | null {
  return strictWhoMayAct(botRedactedView(room, botId));
}
