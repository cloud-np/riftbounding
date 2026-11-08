/**
 * React hooks layer (thin) over the runtime stores.
 *
 * Everything is `useSyncExternalStore` based (no state library), mirroring the original's
 * store subscriptions (`946505.q`). Wave-2 UI agents should consume only this module.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type {
  GameplayAction,
  Room,
  RoomSessionDoc,
  RoomShellAction,
  ViewerRole,
} from "@rift/protocol";
import {
  getAuthToken,
  loginWithPassword,
  readStoredGuestName,
  registerAccount,
  resolveIdentity,
  signOutAccount,
  storeGuestName,
  type GuestIdentity,
} from "./auth";
import { MatchRuntime, type MatchMetadata, type MatchRuntimeState } from "./matchRuntime";
import { EMPTY_PRESENCE, type PresenceSnapshot } from "./presence";
import type {
  MatchmakingClient,
  MatchmakingState,
  MatchmakingSearchAttempt,
  MatchmakingStatus,
} from "./matchmaking";
import { settingsStore, type SettingsState, type SettingsStore } from "./settings";
import { shallowEqual } from "./store";
import type { ExternalStore } from "./store";

/** Subscribe to an external store with a selector. */
export function useStoreSelector<T, S>(
  store: ExternalStore<T>,
  selector: (snapshot: T) => S,
  isEqual: (a: S, b: S) => boolean = Object.is,
): S {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const isEqualRef = useRef(isEqual);
  isEqualRef.current = isEqual;
  const lastRef = useRef<{ value: S } | null>(null);
  const getSnapshot = useCallback(() => {
    const next = selectorRef.current(store.getSnapshot());
    if (lastRef.current && isEqualRef.current(lastRef.current.value, next))
      return lastRef.current.value;
    lastRef.current = { value: next };
    return next;
  }, [store]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

/* ------------------------------------------------------------------ identity */

export interface IdentityState {
  identity: GuestIdentity;
  /** token available (guest token fetched or cached) */
  hasToken: boolean;
  loading: boolean;
  error: string | null;
  /** fetch/refresh the guest token */
  ensureToken: (options?: { skipCache?: boolean }) => Promise<string | null>;
  setDisplayName: (name: string) => void;
  /** password sign-in against the realtime worker; persists the account token */
  signIn: (username: string, password: string) => Promise<GuestIdentity>;
  /** account registration; persists the account token */
  register: (username: string, password: string) => Promise<GuestIdentity>;
  signOut: () => void;
  refreshIdentity: () => GuestIdentity;
}

export function useIdentity(): IdentityState {
  const [identity, setIdentity] = useState<GuestIdentity>(() => resolveIdentity());
  const [hasToken, setHasToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ensureToken = useCallback(async (options?: { skipCache?: boolean }) => {
    setLoading(true);
    try {
      const token = await getAuthToken(options);
      setHasToken(Boolean(token));
      setIdentity(resolveIdentity());
      setError(token ? null : "A sign-in token is temporarily unavailable. Your room is safe.");
      return token;
    } catch (fetchError) {
      setHasToken(false);
      setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void ensureToken();
  }, [ensureToken]);

  const setDisplayName = useCallback((name: string) => {
    storeGuestName(name.trim());
    setIdentity(resolveIdentity());
  }, []);

  const refreshIdentity = useCallback(() => {
    const next = resolveIdentity();
    setIdentity(next);
    return next;
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      await loginWithPassword(username, password);
      const next = resolveIdentity();
      setIdentity(next);
      setHasToken(true);
      return next;
    } catch (signInError) {
      setHasToken(false);
      setError(signInError instanceof Error ? signInError.message : String(signInError));
      throw signInError;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    signOutAccount();
    setHasToken(false);
    setError(null);
    setIdentity(resolveIdentity());
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      await registerAccount(username, password);
      const next = resolveIdentity();
      setIdentity(next);
      setHasToken(true);
      return next;
    } catch (registerError) {
      setHasToken(false);
      setError(registerError instanceof Error ? registerError.message : String(registerError));
      throw registerError;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    identity,
    hasToken,
    loading,
    error,
    ensureToken,
    setDisplayName,
    signIn,
    register,
    signOut,
    refreshIdentity,
  };
}

/** Current guest display name (reads the stored name; used by the lobby). */
export function usePlayerName(): [string, (name: string) => void] {
  const [name, setName] = useState(() => readStoredGuestName());
  const update = useCallback((next: string) => {
    storeGuestName(next.trim());
    setName(next.trim());
  }, []);
  return [name, update];
}

/* ------------------------------------------------------------------ match runtime */

export function useMatchRuntimeState<S>(
  runtime: MatchRuntime | null,
  selector: (state: MatchRuntimeState) => S,
  isEqual?: (a: S, b: S) => boolean,
): S | null {
  const fallback = useMemo(() => null as S | null, []);
  const emptyStore = useMemo(
    () => ({
      getSnapshot: () => null as MatchRuntimeState | null,
      subscribe: () => () => undefined,
    }),
    [],
  );
  const store = runtime ? runtime.store : emptyStore;
  const value = useStoreSelector<MatchRuntimeState | null, S | null>(
    store as ExternalStore<MatchRuntimeState | null>,
    (snapshot) => (snapshot === null ? fallback : selector(snapshot)),
    (isEqual ?? Object.is) as (a: S | null, b: S | null) => boolean,
  );
  return value;
}

export interface ConnectionStatus {
  connectionState: MatchRuntimeState["connectionState"];
  sessionPhase: MatchRuntimeState["sessionPhase"];
  connectionStalled: boolean;
  connectionRecovery: MatchRuntimeState["connectionRecovery"];
  lastError: string | null;
  retryConnection: () => void;
  reconnectNow: () => void;
}

export function useConnectionStatus(runtime: MatchRuntime | null): ConnectionStatus {
  const state = useMatchRuntimeState(
    runtime,
    (snapshot) => ({
      connectionState: snapshot.connectionState,
      sessionPhase: snapshot.sessionPhase,
      connectionStalled: snapshot.connectionStalled,
      connectionRecovery: snapshot.connectionRecovery,
      lastError: snapshot.lastError,
    }),
    shallowEqual,
  );
  return {
    connectionState: state?.connectionState ?? "idle",
    sessionPhase: state?.sessionPhase ?? "disconnected",
    connectionStalled: state?.connectionStalled ?? false,
    connectionRecovery: state?.connectionRecovery ?? "none",
    lastError: state?.lastError ?? null,
    retryConnection: useCallback(() => runtime?.retryConnection(), [runtime]),
    reconnectNow: useCallback(() => runtime?.reconnectNow(), [runtime]),
  };
}

/** Room shell (lobby/setup) state from `room_shell_sync`. */
export function useRoomShell(runtime: MatchRuntime | null): {
  sessionDoc: RoomSessionDoc | null;
  sequence: number | null;
  phase: RoomSessionDoc["phase"] | null;
} {
  const state = useMatchRuntimeState(
    runtime,
    (snapshot) => ({
      sessionDoc: snapshot.roomShellSessionDoc,
      sequence: snapshot.roomShellSequence,
      phase: snapshot.roomShellSessionDoc?.phase ?? null,
    }),
    shallowEqual,
  );
  return state ?? { sessionDoc: null, sequence: null, phase: null };
}

/**
 * Live BO3/series metadata for the board (game-over overlay): wins, both reports, rematch
 * requests and the linked-room handoff codes. Mirrors the original `matchMetadata` projection.
 */
export function useMatchMetadata(runtime: MatchRuntime | null): MatchMetadata | null {
  return useMatchRuntimeState(
    runtime,
    (snapshot) => {
      const room = snapshot.optimisticRoom ?? snapshot.authoritativeProjectedRoom;
      if (!room) return null;
      return {
        roomCode: room.roomCode,
        gameNumber: room.gameNumber ?? 1,
        ...(room.seriesId ? { seriesId: room.seriesId } : {}),
        winsByPlayerId: room.winsByPlayerId ?? {},
        ...(room.pendingGameResult ? { pendingGameResult: room.pendingGameResult } : {}),
        rematchRequestedPlayerIds: room.rematchRequestedPlayerIds ?? [],
        ...(room.nextRoomCode ? { nextRoomCode: room.nextRoomCode } : {}),
        ...(room.returnLobbyRoomCode ? { returnLobbyRoomCode: room.returnLobbyRoomCode } : {}),
        ...(room.matchTermination ? { matchTermination: room.matchTermination } : {}),
      };
    },
    shallowEqual,
  );
}

/**
 * Game state with a selector. Returns the optimistic projection (authoritative + pending intent)
 * when a gameplay intent is in flight, otherwise the authoritative room — matching the original
 * board which renders `cY` output while an action is pending.
 */
export function useGameState<S>(
  runtime: MatchRuntime | null,
  selector: (room: Room) => S,
  isEqual?: (a: S, b: S) => boolean,
): S | null {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const value = useMatchRuntimeState(
    runtime,
    (snapshot) => {
      const room = snapshot.optimisticRoom ?? snapshot.authoritativeProjectedRoom;
      return room ? selectorRef.current(room) : null;
    },
    isEqual ?? Object.is,
  );
  return value;
}

export interface DispatchIntent {
  (
    action: GameplayAction,
    actorPlayerId?: string,
    options?: {
      clientActionId?: string;
      onCommit?: (commit: { before: Room; after: Room } | undefined) => void;
    },
  ): Promise<"committed" | "noop">;
  pending: boolean;
}

/** `sendGameplayAction` bound to the runtime. */
export function useDispatchIntent(runtime: MatchRuntime | null): DispatchIntent {
  const pending =
    useMatchRuntimeState(runtime, (snapshot) => snapshot.gameplayActionPending) ?? false;
  const dispatch = useCallback(
    async (
      action: GameplayAction,
      actorPlayerId?: string,
      options?: {
        clientActionId?: string;
        onCommit?: (commit: { before: Room; after: Room } | undefined) => void;
      },
    ) => {
      if (!runtime) throw new Error("The live realtime match runtime is not active.");
      return runtime.sendGameplayAction(action, actorPlayerId, options);
    },
    [runtime],
  );
  return Object.assign(dispatch, { pending });
}

/** Shell (lobby/setup) action dispatch. */
export function useDispatchShellAction(
  runtime: MatchRuntime | null,
): (
  action: RoomShellAction | { type: string; [k: string]: unknown },
  actorPlayerId?: string,
) => Promise<void> {
  return useCallback(
    async (
      action: RoomShellAction | { type: string; [k: string]: unknown },
      actorPlayerId?: string,
    ) => {
      if (!runtime) throw new Error("The live realtime match runtime is not active.");
      await runtime.sendShellAction(action, actorPlayerId);
    },
    [runtime],
  );
}

export interface ChatApi {
  entries: Array<Record<string, unknown>>;
  canSend: boolean;
  authorId: string | null;
  send: (text: string, clientEntryId?: string, judgeCallId?: string) => boolean;
  publishTyping: (isTyping: boolean) => void;
  spectatorRoster: MatchRuntimeState["spectatorRoster"];
}

export function useChat(runtime: MatchRuntime | null): ChatApi {
  const state = useMatchRuntimeState(
    runtime,
    (snapshot) => ({
      entries: snapshot.chatEntries,
      canSend: snapshot.chatAccess?.canSend ?? true,
      authorId: snapshot.chatAccess?.authorId ?? null,
      spectatorRoster: snapshot.spectatorRoster,
    }),
    shallowEqual,
  );
  return {
    entries: state?.entries ?? [],
    canSend: state?.canSend ?? false,
    authorId: state?.authorId ?? null,
    spectatorRoster: state?.spectatorRoster ?? [],
    send: useCallback(
      (text: string, clientEntryId?: string, judgeCallId?: string) =>
        runtime?.sendChatMessage(text, clientEntryId, judgeCallId) ?? false,
      [runtime],
    ),
    publishTyping: useCallback(
      (isTyping: boolean) => runtime?.publishChatTyping(isTyping),
      [runtime],
    ),
  };
}

/* ------------------------------------------------------------------ matchmaking */

export interface MatchmakingApi {
  status: MatchmakingStatus;
  search: MatchmakingState["search"];
  error: string | null;
  lastError: MatchmakingState["lastError"];
  start: (attempt: MatchmakingSearchAttempt, options?: { resume?: boolean }) => Promise<void>;
  cancel: () => Promise<void>;
  stop: () => void;
}

export function useMatchmaking(client: MatchmakingClient | null): MatchmakingApi {
  const state = useStoreSelector(
    (client?.store ?? {
      getSnapshot: () => null as MatchmakingState | null,
      subscribe: () => () => undefined,
    }) as ExternalStore<MatchmakingState | null>,
    (snapshot) => snapshot,
  );
  return {
    status: state?.status ?? { status: "idle" },
    search: state?.search ?? null,
    error: state?.error ?? null,
    lastError: state?.lastError ?? null,
    start: useCallback(
      async (attempt: MatchmakingSearchAttempt, options?: { resume?: boolean }) => {
        await client?.search(attempt, options);
      },
      [client],
    ),
    cancel: useCallback(async () => {
      await client?.cancel();
    }, [client]),
    stop: useCallback(() => client?.stop(), [client]),
  };
}

/* ------------------------------------------------------------------ presence */

export function usePresence(runtime: MatchRuntime | null): PresenceSnapshot {
  const empty = useMemo<ExternalStore<PresenceSnapshot>>(
    () => ({
      getSnapshot: () => EMPTY_PRESENCE,
      setSnapshot: () => undefined,
      subscribe: () => () => undefined,
    }),
    [],
  );
  return useStoreSelector(runtime ? runtime.presence : empty, (snapshot) => snapshot);
}

/* ------------------------------------------------------------------ settings */ export interface SettingsApi extends SettingsState {
  setSfxVolume: (value: number) => void;
  setPlayMode: SettingsStore["setPlayMode"];
  setPlayerName: SettingsStore["setPlayerName"];
  volumeScale: number;
}

export function useSettings(store: SettingsStore = settingsStore): SettingsApi {
  const state = useStoreSelector(store, (snapshot) => snapshot, shallowEqual);
  return {
    ...state,
    setSfxVolume: store.setSfxVolume,
    setPlayMode: store.setPlayMode,
    setPlayerName: store.setPlayerName,
    volumeScale: store.volumeScale(),
  };
}

/* ------------------------------------------------------------------ session helper */

export interface MatchSessionInput {
  session: {
    roomCode: string;
    playerId: string;
    playerName: string;
    viewerRole: ViewerRole;
    spectatorName?: string;
    playMode: "constructed" | "sealed";
    deckRulesMode: "standard" | "unrestricted";
    lastKnownPhase?: RoomSessionDoc["phase"];
  };
  realtimeSession: { gameInstanceId: string };
  viewerRole?: ViewerRole;
  broadcastView?: boolean;
  gameplayEnabled?: boolean;
}

/** Create + start a `MatchRuntime` for a session (the `/game` route's entry point). */
export function useMatchRuntime(input: MatchSessionInput | null): MatchRuntime | null {
  const [runtime, setRuntime] = useState<MatchRuntime | null>(null);
  const key = input
    ? `${input.realtimeSession.gameInstanceId}:${input.session.roomCode}:${input.session.playerId}:${input.viewerRole ?? "player"}:${input.broadcastView ? "b" : "p"}`
    : null;
  const inputRef = useRef(input);
  inputRef.current = input;
  useEffect(() => {
    if (!key || !inputRef.current) {
      setRuntime(null);
      return;
    }
    const instance = new MatchRuntime({
      session: inputRef.current.session,
      realtimeSession: inputRef.current.realtimeSession,
      viewerRole: inputRef.current.viewerRole ?? inputRef.current.session.viewerRole,
      ...(inputRef.current.broadcastView !== undefined
        ? { broadcastView: inputRef.current.broadcastView }
        : {}),
      ...(inputRef.current.gameplayEnabled !== undefined
        ? { gameplayEnabled: inputRef.current.gameplayEnabled }
        : {}),
    });
    instance.start();
    setRuntime(instance);
    return () => instance.dispose();
  }, [key]);
  return runtime;
}
