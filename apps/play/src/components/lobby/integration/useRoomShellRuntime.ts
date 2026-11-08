"use client";

/**
 * Room-shell runtime bridge: HTTP room creation/join lives in the lobby controller; this hook owns
 * the live `MatchRuntime` for an existing room and exposes the `room_shell_sync` projection plus
 * shell actions. It is the only place the lobby talks to `/parties/match/<CODE>` over websockets.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { GameVariant, MatchFormat, RoomSessionDoc } from "@rift/protocol";

import {
  useConnectionStatus,
  useChat,
  useMatchRuntime,
  useRoomShell,
  type ConnectionStatus,
  type MatchRuntime,
} from "@/runtime";

import type { GameSession } from "./session";

export interface RoomShellRuntimeSession {
  roomCode: string;
  gameInstanceId: string;
  playerId: string;
  playerName: string;
  viewerRole: "player" | "spectator";
  playMode: "constructed" | "sealed";
  deckRulesMode: "standard" | "unrestricted";
  controlledPlayerIds?: string[];
  roomMode?: GameSession["roomMode"];
  variant?: GameVariant;
  format?: MatchFormat;
  lastKnownPhase?: string;
}

export interface RoomShellRuntime {
  runtime: MatchRuntime | null;
  sessionDoc: RoomSessionDoc | null;
  phase: RoomSessionDoc["phase"] | null;
  sequence: number | null;
  chatEntries: Array<Record<string, unknown>>;
  spectators: ReturnType<typeof useChat>["spectatorRoster"];
  connection: ConnectionStatus;
  sendShellAction: (
    action: { type: string; [k: string]: unknown },
    actorPlayerId?: string,
  ) => Promise<void>;
  sendChat: (text: string) => boolean;
}

export function useRoomShellRuntime(
  session: RoomShellRuntimeSession | null,
  options: {
    onGameStarted?: (sessionDoc: RoomSessionDoc) => void;
    onSessionDoc?: (sessionDoc: RoomSessionDoc | null) => void;
  } = {},
): RoomShellRuntime {
  const input = useMemo(
    () =>
      session
        ? {
            session: {
              roomCode: session.roomCode,
              playerId: session.playerId,
              playerName: session.playerName,
              viewerRole: session.viewerRole,
              playMode: session.playMode,
              deckRulesMode: session.deckRulesMode,
              ...(session.lastKnownPhase
                ? { lastKnownPhase: session.lastKnownPhase as RoomSessionDoc["phase"] }
                : {}),
              ...(session.controlledPlayerIds
                ? { controlledPlayerIds: session.controlledPlayerIds }
                : {}),
            },
            realtimeSession: { gameInstanceId: session.gameInstanceId },
            viewerRole: session.viewerRole,
          }
        : null,
    [
      session?.roomCode,
      session?.gameInstanceId,
      session?.playerId,
      session?.playerName,
      session?.viewerRole,
      session?.playMode,
      session?.deckRulesMode,
      session?.lastKnownPhase,
      session?.controlledPlayerIds?.join(","),
    ],
  );

  const runtime = useMatchRuntime(input);
  const shell = useRoomShell(runtime);
  const chat = useChat(runtime);
  const connection = useConnectionStatus(runtime);

  const onGameStartedRef = useRef(options.onGameStarted);
  onGameStartedRef.current = options.onGameStarted;
  const startedForphase = useRef(false);

  useEffect(() => {
    startedForphase.current = false;
  }, [session?.roomCode, session?.playerId]);

  useEffect(() => {
    if (!shell.sessionDoc) return;
    options.onSessionDoc?.(shell.sessionDoc);
    const phase = shell.sessionDoc.phase;
    const active = phase !== "lobby";
    if (active && !startedForphase.current) {
      startedForphase.current = true;
      onGameStartedRef.current?.(shell.sessionDoc);
    }
    if (!active) startedForphase.current = false;
  }, [shell.sessionDoc, shell.sequence]);

  const sendShellAction = useCallback(
    async (action: { type: string; [k: string]: unknown }, actorPlayerId?: string) => {
      if (!runtime) throw new Error("The room is still connecting.");
      await runtime.sendShellAction(action, actorPlayerId ?? session?.playerId);
    },
    [runtime, session?.playerId],
  );

  const sendChat = useCallback(
    (text: string) => runtime?.sendChatMessage(text) ?? false,
    [runtime],
  );

  return {
    runtime,
    sessionDoc: shell.sessionDoc,
    phase: shell.phase,
    sequence: shell.sequence,
    chatEntries: chat.entries,
    spectators: chat.spectatorRoster,
    connection,
    sendShellAction,
    sendChat,
  };
}
