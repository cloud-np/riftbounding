"use client";

/**
 * Live `/game` screen.
 *
 * Reads the lobby → game session handoff (`riftbound_simulator_active_room` or query params),
 * opens the match runtime (`join_shell` → `join_game` / `resume_game` with reconnection), and
 * renders the authoritative room through the wave-2 board slots. Slots receive exactly
 * `BoardSlotProps`; every intent is dispatched through the runtime's optimistic/authoritative
 * action pipeline (same composition as `src/dev/LocalGameHarness.tsx`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameplayAction, Room, RoomPlayer, RoomSessionDoc } from "@rift/protocol";
import { strictLegalIntents, strictWhoMayAct } from "@rift/engine";
import { createTranslator, rulesRejectionText } from "@rift/i18n";

import { ChainSlot } from "@/components/board/chain";
import { BoardInteractionProvider, HandSlot } from "@/components/board/interaction";
import { OverlaysSlot, PromptsSlot } from "@/components/board/prompts";
import type {
  BoardSlotProps,
  Dispatch,
  DispatchAs,
  GameActionIntent,
} from "@/components/board/slot-types";
import { SidebarSlot } from "@/components/board/sidebar";
import { cardName, strictActorFor } from "@/components/board/strict/strict-model";
import type { BattlefieldInfo } from "@/components/board/layout/BattlefieldLayer";
import type { GameBoardLayoutHints } from "@/components/board/layout/GameBoardView";
import { GameBoardView } from "@/components/board/layout/GameBoardView";
import {
  GAME_START_SOUND,
  REALTIME_CONNECTION_FAILED_MESSAGE,
  REALTIME_CONNECTION_LOST_MESSAGE,
  RESYNCING_MESSAGE,
  ROOM_UNAVAILABLE_MESSAGE,
  SEAT_SUPERSEDED_MESSAGE,
  STARTUP_RECOVERY_EXHAUSTED_MESSAGE,
  claimDisconnectWin,
  createNextGame,
  deriveActionSound,
  deriveBaronPitSound,
  deriveTurnStartSound,
  getAuthToken,
  isRoomApiError,
  isRulesRejectionError,
  leaveRoom as leaveRoomApi,
  resolveRoomMembership,
  returnToLobby as returnToLobbyApi,
  roomSeriesAction,
  soundEngine,
  useChat,
  useConnectionStatus,
  useDispatchIntent,
  useGameState,
  useMatchRuntime,
  useMatchRuntimeState,
  usePresence,
  useRoomShell,
} from "@/runtime";

import { actionClockTotals, formatElapsed } from "@/components/board/header/clock";
import { nextGameAction } from "@/components/board/header/room-actions";

import { chooseIntentActor } from "./actors";
import {
  clearActiveGameSession,
  clearGameSessions,
  createGameSession,
  gameHref,
  type GameSession,
  resolveGameSession,
  saveGameSession,
} from "@/components/lobby/integration/session";
import { linkedRoomLastKnownPhase, linkedRoomSession, lobbyHref } from "./match-navigation";

export interface GameScreenProps {
  room?: string | null;
  gameInstanceId?: string | null;
  playerId?: string | null;
  viewer?: string | null;
}

declare global {
  interface Window {
    /** Development-only setup/action hook (`NODE_ENV=development`). */
    __riftDebug?: {
      dispatch: (intent: unknown, actorPlayerId?: string) => void;
      getState: () => Room | null;
      getViewerId: () => string | null;
      getControlledPlayerIds: () => string[];
      getActionClock: () => unknown;
      getPresence: () => unknown;
      publishEmote: (emoteId: string) => void;
      publishCardPing: (cardId: string) => void;
    };
  }
}

const rulesText = createTranslator("en");

function errorText(error: unknown, room?: Parameters<typeof cardName>[0] | null): string {
  // Strict rooms (§5): the server's ReasonCode + rule + the engine's plain-language detail.
  if (isRulesRejectionError(error)) {
    const detail = error.detail;
    return rulesRejectionText(
      rulesText,
      { code: error.code, rule: error.rule, detail },
      room ? (id) => cardName(room, id) : undefined,
    );
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return "The action could not be completed.";
}

function battlefieldHint(
  player: RoomPlayer | undefined,
  zone: "battlefieldA" | "battlefieldB",
): BattlefieldInfo | undefined {
  if (!player) return undefined;
  const selected = player.selectedBattlefield?.trim();
  const preview = selected || player.battlefieldOptions?.[0]?.trim();
  if (!preview) return undefined;
  return {
    zone,
    name: preview,
    ...(selected && player.selectedBattlefieldCardCode
      ? { cardCode: player.selectedBattlefieldCardCode }
      : {}),
  };
}

function victoryScoreFor(room: Room): number {
  return room.gameVariant === "teams_2v2" ? 11 : 8;
}

export function GameScreen({ room: roomParam, gameInstanceId, playerId, viewer }: GameScreenProps) {
  const router = useRouter();
  const [session, setSession] = useState<GameSession | null>(null);
  const [booted, setBooted] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const lastNoticeLogRef = useRef<string | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);

  useEffect(() => {
    const resolved = resolveGameSession({
      room: roomParam,
      gameInstanceId,
      playerId,
      viewer,
    });
    setSession(resolved);
    setBooted(true);
    if (!resolved) router.replace("/");
  }, [roomParam, gameInstanceId, playerId, viewer, router]);

  // A room shell in its lobby phase belongs on `/` (e.g. after "Return to Lobby").
  const runtimeInput = useMemo(
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
            },
            realtimeSession: { gameInstanceId: session.gameInstanceId },
            viewerRole: session.viewerRole,
          }
        : null,
    [session],
  );

  const runtime = useMatchRuntime(runtimeInput);
  const shell = useRoomShell(runtime);
  const room = useGameState(runtime, (state) => state);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);

  // Strict rewind/forward feedback: the server appends a `rewound`/`restoredTimeline` log
  // entry; show "Rewound to turn N, step M" once per new entry.
  const lastLog = room?.log?.at(-1);
  useEffect(() => {
    if (!lastLog) return;
    if (lastNoticeLogRef.current === null) {
      lastNoticeLogRef.current = lastLog.id;
      return;
    }
    if (lastNoticeLogRef.current === lastLog.id) return;
    lastNoticeLogRef.current = lastLog.id;
    if (lastLog.actionKind === "rewind") {
      setActionNotice(
        rulesText("rules.ui.rewoundTo", {
          turn: room?.turnNumber ?? 0,
          step: room?.rewindStep ?? 0,
        }) ?? null,
      );
    } else if (lastLog.actionKind === "forward") {
      setActionNotice(
        rulesText("rules.ui.forwardedTo", {
          turn: room?.turnNumber ?? 0,
          step: room?.rewindStep ?? 0,
        }) ?? null,
      );
    }
  }, [lastLog?.id, lastLog?.actionKind, room?.turnNumber, room?.rewindStep]);

  useEffect(() => {
    if (!actionNotice) return;
    const timer = window.setTimeout(() => setActionNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);
  useEffect(() => {
    setResultDialogOpen(false);
  }, [session?.roomCode]);
  const connection = useConnectionStatus(runtime);
  const dispatchIntent = useDispatchIntent(runtime);
  const chat = useChat(runtime);
  const presence = usePresence(runtime);
  const actionClock = useMatchRuntimeState(runtime, (snapshot) => snapshot.actionClockSnapshot);
  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => {
    if (!actionClock) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [actionClock]);
  const clocksByPlayerId = useMemo(() => {
    if (!actionClock) return undefined;
    const playerIds = (room?.players ?? [])
      .filter((player) => !player.leftAt && !player.isBot)
      .map((player) => player.id);
    const totals = actionClockTotals(actionClock, playerIds, clockNow);
    return Object.fromEntries(
      Object.entries(totals).map(([playerId, ms]) => [playerId, formatElapsed(ms)]),
    );
  }, [actionClock, clockNow, room?.players]);
  const connectedIdsKey = useMatchRuntimeState(runtime, (snapshot) =>
    snapshot.hasPresenceSnapshot ? snapshot.connectedPlayerIds.join(",") : null,
  );
  const connectedPlayerIds = useMemo(
    () => (connectedIdsKey === null ? undefined : connectedIdsKey.split(",").filter(Boolean)),
    [connectedIdsKey],
  );

  useEffect(() => {
    if (session && shell.phase === "lobby") router.replace("/");
  }, [session, shell.phase, router]);

  const controlledPlayerIds = useMemo(() => {
    if (!session || session.viewerRole === "spectator") return [];
    if (room && room.roomMode !== "multiplayer") {
      return room.players.filter((player) => !player.leftAt).map((player) => player.id);
    }
    const requested =
      session.controlledPlayerIds && session.controlledPlayerIds.length > 0
        ? session.controlledPlayerIds
        : [session.playerId];
    const present = new Set((room?.players ?? []).map((player) => player.id));
    return requested.filter((id) => present.size === 0 || present.has(id));
  }, [session, room]);

  const effectiveViewerId = useMemo(() => {
    if (!session) return null;
    if (
      viewerId &&
      (controlledPlayerIds.includes(viewerId) || session.viewerRole === "spectator")
    ) {
      return viewerId;
    }
    if (session.viewerRole === "spectator") return room?.players[0]?.id ?? session.playerId;
    return controlledPlayerIds[0] ?? session.playerId;
  }, [session, viewerId, controlledPlayerIds, room]);

  const viewerIdRef = useRef<string | null>(effectiveViewerId);
  viewerIdRef.current = effectiveViewerId;
  const roomRef = useRef<Room | null>(room);
  roomRef.current = room;

  /* ---------------------------------------------------- match-advance redirects */

  const linkedRoomRef = useRef<string | null>(null);
  const lobbyReturnRef = useRef<string | null>(null);
  const membershipCheckedRef = useRef<string | null>(null);

  const linkedRoomPhase = useCallback(
    () => linkedRoomLastKnownPhase(shell.sessionDoc),
    [shell.sessionDoc],
  );

  /** Follow `nextRoomCode` / `room_advanced` / `redirectedFromRoomCode`. */
  const switchLinkedRoom = useCallback(
    (roomCode: string, lastKnownPhase?: "battlefield_pick" | "sideboarding") => {
      if (!session) return;
      const code = roomCode.trim().toUpperCase();
      if (!code || code === session.roomCode || linkedRoomRef.current === code) return;
      linkedRoomRef.current = code;
      const next = linkedRoomSession(session, code, lastKnownPhase ?? linkedRoomPhase());
      saveGameSession(next);
      setSession(next);
      setActionError(null);
      router.replace(gameHref(next));
    },
    [session, linkedRoomPhase, router],
  );

  /** Land in the shared lobby allocated by `return_to_lobby`. */
  const navigateToLobby = useCallback(
    (roomCode?: string | null) => {
      const code = roomCode?.trim().toUpperCase();
      const key = code || "current";
      if (lobbyReturnRef.current === key) return;
      lobbyReturnRef.current = key;
      clearGameSessions();
      const target = code && session && code !== session.roomCode ? code : undefined;
      router.push(lobbyHref(target));
    },
    [session, router],
  );

  // Restoring a stale room: the server redirects membership to the linked room
  // (`redirectedFromRoomCode`), so follow it before the old socket settles.
  useEffect(() => {
    if (!session) return;
    const roomCode = session.roomCode;
    if (membershipCheckedRef.current === roomCode) return;
    membershipCheckedRef.current = roomCode;
    let cancelled = false;
    void (async () => {
      const token = await getAuthToken();
      if (!token || cancelled) return;
      try {
        const membership = await resolveRoomMembership({ roomCode, authToken: token });
        if (cancelled) return;
        if (membership.role === "absent") {
          clearGameSessions();
          router.replace("/");
          return;
        }
        if (membership.roomCode !== roomCode) switchLinkedRoom(membership.roomCode);
      } catch {
        /* best effort: the live socket remains authoritative */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, router, switchLinkedRoom]);

  // BO3 next game / rematch: the shell publishes `nextRoomCode` before the new
  // room's snapshot exists. Swap the session so the runtime reconnects there.
  const nextRoomCode = shell.sessionDoc?.nextRoomCode ?? room?.nextRoomCode ?? null;
  useEffect(() => {
    if (!session || !nextRoomCode) return;
    switchLinkedRoom(nextRoomCode);
  }, [session, nextRoomCode, switchLinkedRoom]);

  // Return-to-lobby: only the player whose seat was returned follows the lobby
  // code (the opponent keeps the result dialog until they choose too).
  const returnLobbyRoomCode =
    shell.sessionDoc?.returnLobbyRoomCode ?? room?.returnLobbyRoomCode ?? null;
  const selfReturnedToLobby = !!room?.players.find((player) => player.id === session?.playerId)
    ?.leftAt;
  useEffect(() => {
    if (!session || !returnLobbyRoomCode || !selfReturnedToLobby) return;
    navigateToLobby(returnLobbyRoomCode);
  }, [session, returnLobbyRoomCode, selfReturnedToLobby, navigateToLobby]);

  useEffect(() => {
    if (!room) return;
    // If the persisted seat vanished (room reset), fall back to the first seat.
    if (
      session?.viewerRole !== "spectator" &&
      effectiveViewerId &&
      !room.players.some((player) => player.id === effectiveViewerId) &&
      room.players[0]
    ) {
      setViewerId(room.players[0].id);
    }
  }, [room, session?.viewerRole, effectiveViewerId]);

  /* ---------------------------------------------------------------- sounds */

  const previousRoomRef = useRef<Room | null>(null);
  useEffect(() => {
    if (!room) return;
    const previous = previousRoomRef.current;
    if (previous) {
      const turnSound = deriveTurnStartSound(previous, room);
      if (turnSound) soundEngine.play(turnSound);
      const baronSound = deriveBaronPitSound(previous, room);
      if (baronSound) soundEngine.play(baronSound);
      if (previous.phase !== "in_game" && room.phase === "in_game") {
        soundEngine.play(GAME_START_SOUND);
      }
    } else if (room.phase === "in_game") {
      soundEngine.play(GAME_START_SOUND);
    }
    previousRoomRef.current = room;
  }, [room]);

  useEffect(() => {
    soundEngine.preloadAll();
  }, []);

  // Setup overlays can leave the document scrolled a few pixels; the board is a
  // fixed 100dvh surface (original `.sim-game-viewport` behaviour).
  useEffect(() => {
    if (room?.phase !== "in_game") return;
    window.scrollTo(0, 0);
  }, [room?.phase]);

  /* ---------------------------------------------------------------- dispatch */

  const sendIntent = useCallback(
    (requested: GameActionIntent, actorOverride?: string) => {
      if (!runtime || !room || !session || session.viewerRole === "spectator") return;
      const intent = requested;
      const actor =
        actorOverride ??
        chooseIntentActor(intent, room, effectiveViewerId ?? session.playerId, controlledPlayerIds);
      setActionError(null);
      void dispatchIntent(intent as GameplayAction, actor, {
        onCommit: (commit) => {
          if (!commit) return;
          const { before, after } = commit;
          if (!before || !after) return;
          const boardBefore = before.players.find((player) => player.id === actor)?.board;
          if (!boardBefore) return;
          const key = deriveActionSound(intent as GameplayAction, {
            actorPlayerId: actor,
            boardBefore,
            roomBefore: before,
            victoryScore: victoryScoreFor(before),
          });
          if (key) soundEngine.play(key);
        },
      }).catch((error) => setActionError(errorText(error, room)));
    },
    [runtime, room, session, effectiveViewerId, controlledPlayerIds, dispatchIntent],
  );

  const dispatch = useCallback<Dispatch>((intent) => sendIntent(intent), [sendIntent]);
  const dispatchAs = useCallback<DispatchAs>(
    (playerId, intent) => sendIntent(intent, playerId),
    [sendIntent],
  );

  /* ---------------------------------------------------------------- perspective */

  const switchPerspective = useCallback(() => {
    if (controlledPlayerIds.length < 2 || !effectiveViewerId) return;
    const index = controlledPlayerIds.indexOf(effectiveViewerId);
    const next = controlledPlayerIds[(index + 1) % controlledPlayerIds.length];
    if (next) setViewerId(next);
  }, [controlledPlayerIds, effectiveViewerId]);

  const switchSeat = useCallback(
    (playerId: string) => {
      if (!controlledPlayerIds.includes(playerId)) return;
      setViewerId(playerId);
    },
    [controlledPlayerIds],
  );

  const boardEmote = useCallback(
    (emoteId: string) => {
      runtime?.publishBoardEmote(emoteId, Date.now());
    },
    [runtime],
  );

  const boardCardPing = useCallback(
    (cardId: string) => {
      runtime?.publishCardPing(cardId, Date.now(), "general");
    },
    [runtime],
  );

  /* ---------------------------------------------------------------- room HTTP actions */

  const withAuthToken = useCallback(
    async (action: (authToken: string) => Promise<unknown>) => {
      try {
        const token = await getAuthToken();
        if (!token) throw new Error("Sign in to use room actions.");
        await action(token);
      } catch (error) {
        if (isRoomApiError(error) && error.code === "room_advanced" && error.continuationRoomCode) {
          switchLinkedRoom(error.continuationRoomCode);
          return;
        }
        setActionError(errorText(error));
      }
    },
    [switchLinkedRoom],
  );

  const requestNextGame = useCallback(() => {
    if (!session || !room) return;
    // Original `startNextGame` (35qz5rkx7yexy.js:35005-35095): NEXT in a BO3 never
    // allocates a linked room directly. It opens the winner-confirmation dialog
    // (requesting both reporters) once a game result exists; `create_next_game` is
    // only for BO1, where it resets the same room to a fresh board in place.
    const action = nextGameAction(room);
    if (action === "open_result_dialog") {
      setResultDialogOpen(true);
      return;
    }
    if (action === "request_result_confirmation") {
      void withAuthToken(async (authToken) => {
        await roomSeriesAction({
          roomCode: session.roomCode,
          authToken,
          type: "request_game_result_confirmation",
        });
        setResultDialogOpen(true);
      });
      return;
    }
    void withAuthToken(async (authToken) => {
      const result = await createNextGame({ roomCode: session.roomCode, authToken });
      const nextRoomCode = typeof result.nextRoomCode === "string" ? result.nextRoomCode : null;
      if (nextRoomCode) switchLinkedRoom(nextRoomCode);
    });
  }, [session, room, withAuthToken, switchLinkedRoom]);

  const claimWin = useCallback(() => {
    if (!session) return;
    void withAuthToken((authToken) =>
      claimDisconnectWin({ roomCode: session.roomCode, authToken }),
    );
  }, [session, withAuthToken]);

  const leaveRoomCompletely = useCallback(async () => {
    if (!session) {
      router.push("/");
      return;
    }
    try {
      const token = await getAuthToken();
      if (token) {
        await leaveRoomApi({
          roomCode: session.roomCode,
          playerId: session.playerId,
          viewerRole: session.viewerRole,
          authToken: token,
        });
      }
    } catch {
      /* best effort */
    }
    clearActiveGameSession();
    clearGameSessions();
    router.push("/");
  }, [session, router]);

  const returnToLobbyFromGame = useCallback(async () => {
    if (!session) {
      router.push("/");
      return;
    }
    let lobbyRoomCode: string | undefined;
    try {
      const token = await getAuthToken();
      if (token) {
        const result = await returnToLobbyApi({
          roomCode: session.roomCode,
          authToken: token,
        });
        lobbyRoomCode = result.lobbyRoomCode;
      }
    } catch (error) {
      if (isRoomApiError(error) && error.code === "room_advanced" && error.continuationRoomCode) {
        switchLinkedRoom(error.continuationRoomCode);
        return;
      }
      /* best effort */
    }
    navigateToLobby(lobbyRoomCode);
  }, [session, router, switchLinkedRoom, navigateToLobby]);

  /* ---------------------------------------------------------------- debug hook */

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const debug = {
      dispatch: (intent: unknown, actorPlayerId?: string) => {
        sendIntent(intent as GameActionIntent, actorPlayerId);
      },
      getState: () => roomRef.current,
      getViewerId: () => viewerIdRef.current,
      getControlledPlayerIds: () => [...controlledPlayerIds],
      getActionClock: () => actionClock,
      getPresence: () => presence,
      publishEmote: (emoteId: string) => boardEmote(emoteId),
      publishCardPing: (cardId: string) => boardCardPing(cardId),
    };
    window.__riftDebug = debug;
    return () => {
      if (window.__riftDebug === debug) delete window.__riftDebug;
    };
  }, [sendIntent, controlledPlayerIds, actionClock, presence, boardEmote, boardCardPing]);

  /* ---------------------------------------------------------------- layout hints */

  const layoutHints = useMemo<GameBoardLayoutHints>(() => {
    if (!room) return {};
    const viewerPlayer =
      room.players.find((player) => player.id === effectiveViewerId) ?? room.players[0];
    const opponent = room.players.find((player) => player.id !== viewerPlayer?.id);
    // Strict rooms: the board's turn button follows `legalIntents.canEndTurn` (312/316).
    const strict =
      room.rulesMode === "strict" && room.phase === "in_game" && !!room.rules;
    const strictLegal =
      strict && viewerPlayer
        ? strictLegalIntents(
            room,
            strictActorFor(
              strictWhoMayAct(room),
              viewerPlayer.id,
              controlledPlayerIds.length > 0 ? controlledPlayerIds : [viewerPlayer.id],
            ),
          )
        : null;
    return {
      boardLines: "default",
      showScoreTrack: true,
      showTurnControls: room.phase === "in_game",
      canEndTurn: room.phase === "in_game" && (!strict || !!strictLegal?.canEndTurn),
      canSwitchSeat: controlledPlayerIds.length > 1,
      clocksByPlayerId,
      connectedPlayerIds,
      phase: room.activeTurnStep === "beginning" ? "beginning" : "main",
      activeTurnSide: room.activeTurnPlayerId === viewerPlayer?.id ? "self" : "opponent",
      battlefields: {
        own: battlefieldHint(viewerPlayer, "battlefieldA"),
        opponent: battlefieldHint(opponent, "battlefieldB"),
      },
    };
  }, [room, effectiveViewerId, controlledPlayerIds, clocksByPlayerId, connectedPlayerIds]);

  // BO3 results are rendered by `GameOverOverlay`; the original keeps a BO1 game on the
  // board and surfaces the departure banner (the overlay only opens from BO3 NEXT / reports).
  const slotProps: BoardSlotProps | null = useMemo(
    () =>
      room && effectiveViewerId
        ? {
            state: room,
            viewerId: effectiveViewerId,
            controlledPlayerIds,
            dispatch,
            dispatchAs,
            mode:
              room.roomMode === "solo_lab"
                ? "solo_lab"
                : room.roomMode === "single_player"
                  ? "single_player"
                  : "multiplayer",
            actionClock,
            connectedPlayerIds,
            presence,
            onSwitchSeat: switchSeat,
            onNextGame: requestNextGame,
            onLeaveRoom: () => void leaveRoomCompletely(),
            onReturnToLobby: () => void returnToLobbyFromGame(),
            onClaimWin: claimWin,
            onBoardEmote: boardEmote,
            resultDialogOpen,
            onResultDialogDismiss: () => setResultDialogOpen(false),
          }
        : null,
    [
      room,
      effectiveViewerId,
      controlledPlayerIds,
      dispatch,
      dispatchAs,
      actionClock,
      connectedPlayerIds,
      presence,
      switchSeat,
      requestNextGame,
      leaveRoomCompletely,
      returnToLobbyFromGame,
      claimWin,
      boardEmote,
      resultDialogOpen,
    ],
  );

  /* ---------------------------------------------------------------- banners */

  const banner = useMemo(() => {
    if (connection.sessionPhase === "superseded") {
      return { text: SEAT_SUPERSEDED_MESSAGE, tone: "error" as const, retry: false };
    }
    if (connection.connectionStalled) {
      return { text: STARTUP_RECOVERY_EXHAUSTED_MESSAGE, tone: "error" as const, retry: true };
    }
    if (connection.lastError) {
      const roomGone =
        connection.lastError === ROOM_UNAVAILABLE_MESSAGE ||
        /room is unavailable|room not found|could no longer/i.test(connection.lastError);
      return {
        text: connection.lastError,
        tone: "error" as const,
        retry: !roomGone,
      };
    }
    if (connection.sessionPhase === "resyncing") {
      return { text: RESYNCING_MESSAGE, tone: "info" as const, retry: false };
    }
    if (connection.connectionState === "connecting") {
      return { text: "Connecting to the live match…", tone: "info" as const, retry: false };
    }
    if (
      connection.connectionState === "closed" ||
      connection.connectionState === "error" ||
      connection.sessionPhase === "disconnected"
    ) {
      return {
        text:
          connection.connectionState === "error"
            ? REALTIME_CONNECTION_FAILED_MESSAGE
            : REALTIME_CONNECTION_LOST_MESSAGE,
        tone: "error" as const,
        retry: true,
      };
    }
    return null;
  }, [connection]);

  if (!booted) {
    return <FullScreenMessage message="Loading the live match…" testId="game-loading" />;
  }
  if (!session) {
    return <FullScreenMessage message="Returning to the lobby…" testId="game-redirect" />;
  }

  const handCounts = room?.players.map((player) => player.board?.hand.length ?? 0).join(",") ?? "";
  const deckCounts = room?.players.map((player) => player.board?.deck.length ?? 0).join(",") ?? "";

  return (
    <div
      className="hub-theme relative h-[100dvh] w-full overflow-hidden bg-[#07101c] text-white"
      data-testid="game-screen"
      data-room-code={session.roomCode}
    >
      <div
        className="sim-game-viewport h-full"
        data-padded="false"
        style={{
          padding:
            "max(0.5rem, env(safe-area-inset-top)) max(0.5rem, env(safe-area-inset-right)) max(0.5rem, env(safe-area-inset-bottom)) max(0.5rem, env(safe-area-inset-left))",
        }}
      >
        {room && slotProps ? (
          <BoardInteractionProvider
            {...slotProps}
            dispatchAs={dispatchAs}
            onSwitchPerspective={switchPerspective}
            onCardPing={boardCardPing}
          >
            <GameBoardView
              state={room}
              viewerId={slotProps.viewerId}
              layoutHints={layoutHints}
              slots={{
                sidebar: (
                  <SidebarSlot
                    {...slotProps}
                    chat={{
                      ...chat,
                      typingPlayers: Object.entries(presence.chatTypingByPlayerId)
                        .filter(([playerId, typing]) => typing && playerId !== effectiveViewerId)
                        .map(
                          ([playerId]) =>
                            room.players.find((player) => player.id === playerId)?.name ?? "Player",
                        ),
                      onBoardEmote: boardEmote,
                    }}
                    chain={<ChainSlot {...slotProps} embedded />}
                  />
                ),
                hand: <HandSlot {...slotProps} />,
                prompts: <PromptsSlot {...slotProps} />,
                overlays: <OverlaysSlot {...slotProps} state={room} />,
              }}
            />
          </BoardInteractionProvider>
        ) : (
          <div className="grid h-full place-items-center" data-testid="game-waiting">
            <div className="grid gap-2 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#9fdff2]">
                Preparing the board
              </p>
              <p className="text-xs text-[#8ea9c9]">
                {shell.phase ? `Phase: ${shell.phase}` : "Connecting to the match room…"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Shell test hook: the visible room code / seat switch / leave live in the sidebar,
          exactly like the original. Keep this transparent hit target for integration tests. */}
      <button
        type="button"
        data-testid="game-leave"
        aria-label="Back to Lobby"
        onClick={() => void returnToLobbyFromGame()}
        className="absolute left-0 top-0 z-50 h-10 w-10 cursor-default border-0 bg-transparent opacity-0"
      />

      {banner ? (
        <div
          data-testid="game-connection-banner"
          data-tone={banner.tone}
          className={`pointer-events-auto absolute inset-x-0 top-14 z-50 mx-auto flex w-fit max-w-[92vw] items-center gap-3 rounded-md border px-3 py-2 text-[0.72rem] shadow-lg ${
            banner.tone === "error"
              ? "border-[rgba(242,138,138,0.4)] bg-[rgba(52,18,24,0.92)] text-[#ffd5d5]"
              : "border-[rgba(116,239,255,0.32)] bg-[rgba(10,27,43,0.92)] text-[#d7eaff]"
          }`}
          role="status"
        >
          <span>{banner.text}</span>
          {banner.retry ? (
            <button
              type="button"
              data-testid="game-reconnect"
              className="underline underline-offset-2"
              onClick={() => connection.retryConnection()}
            >
              Retry
            </button>
          ) : null}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => void returnToLobbyFromGame()}
          >
            Return to lobby
          </button>
        </div>
      ) : null}

      {actionNotice ? (
        <div
          data-testid="game-notice"
          role="status"
          className="absolute inset-x-0 top-28 z-50 mx-auto flex w-fit max-w-[92vw] items-center gap-3 rounded-md border border-[rgba(116,239,255,0.32)] bg-[rgba(10,27,43,0.94)] px-3 py-2 text-[0.72rem] text-[#d7eaff] shadow-lg"
        >
          <span>{actionNotice}</span>
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => setActionNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {actionError ? (
        <div
          data-testid="game-error"
          role="alert"
          className="absolute inset-x-0 top-28 z-50 mx-auto flex w-fit max-w-[92vw] items-center gap-3 rounded-md border border-[rgba(242,138,138,0.4)] bg-[rgba(52,18,24,0.94)] px-3 py-2 text-[0.72rem] text-[#ffd5d5] shadow-lg"
        >
          <span>{actionError}</span>
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div
        data-testid="game-state"
        data-phase={room?.phase ?? shell.phase ?? ""}
        data-turn={room?.turnNumber ?? 0}
        data-active-player-id={room?.activeTurnPlayerId ?? ""}
        data-viewer-id={effectiveViewerId ?? ""}
        data-controlled-player-ids={controlledPlayerIds.join(",")}
        data-hand-counts={handCounts}
        data-deck-counts={deckCounts}
        data-session-phase={connection.sessionPhase}
        data-connection-state={connection.connectionState}
        className="sr-only"
      />
    </div>
  );
}

function FullScreenMessage({ message, testId }: { message: string; testId: string }) {
  return (
    <div
      className="hub-theme grid h-[100dvh] w-full place-items-center bg-[#060b15] text-[#9fdff2]"
      data-testid={testId}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.16em]">{message}</p>
    </div>
  );
}
