/**
 * HTTP room API client — coordinator + match room + matchmaking cancel/resolve.
 *
 * Verbatim port of `.recon/pretty/playapp/35qz5rkx7yexy.js`:
 *  - `db` (L21700-21830): POST JSON as `content-type: text/plain;charset=UTF-8`, 12s timeout,
 *    abort handling, error strings and codes, `RoomApiError` (`o5`) shape.
 *  - `dh` create_room (coordinator), `dg` join_room, `dy` switch_to_spectator, `dx` take_seat,
 *    `dv` resolve_room_membership (8s timeout), `dk` create_next_game, `dw` room_series_action,
 *    `d_` leave_room (keepalive), `dC` abandon_match, `dI` claim_disconnect_win,
 *    `dj` return_to_lobby, `dN` matchmaking `cancel_exact`/`reset_exact`.
 *  - Response validation is reproduced as-is (invalid results throw
 *    `invalid_room_api_response` / `invalid_create_room_response` / …).
 *
 * Task contract: `create_room` via the coordinator, everything else on
 * `/parties/match/<CODE>`; room codes are uppercased on the wire.
 */

import type {
  ConstructedDeckRegistration,
  CreateRoomResponse,
  JoinRoomResponse,
  LeaveRoomResponse,
  MatchmakingCancelResponse,
  ResolveRoomMembershipResponse,
  ReturnToLobbyResponse,
  RoomApiError as RoomApiErrorBody,
  RoomPhase,
  TakeSeatResponse,
  GameVariant,
  MatchFormat,
  PlayMode,
  ViewerRole,
} from "@rift/protocol";
import { realtimeHttpBase } from "./config";

export type AuthRecovery = "retry_verification" | "refresh_token" | "reauthenticate";

/** `o3` — only the three known recovery values pass through. */
export function normalizeAuthRecovery(value: unknown): AuthRecovery | undefined {
  return value === "retry_verification" || value === "refresh_token" || value === "reauthenticate"
    ? value
    : undefined;
}

/** `o5` — typed room API error. */
export class RoomApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly continuationRoomCode?: string;
  readonly authRecovery?: AuthRecovery;

  constructor(
    message: string,
    options: {
      status: number;
      code: string;
      retryable: boolean;
      cause?: unknown;
      continuationRoomCode?: string;
      authRecovery?: AuthRecovery;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "RoomApiError";
    this.status = options.status;
    this.code = options.code;
    this.retryable = options.retryable;
    const continuation = options.continuationRoomCode?.trim().toUpperCase();
    if (continuation) this.continuationRoomCode = continuation;
    this.authRecovery = options.authRecovery;
  }
}

export function isRoomApiError(error: unknown): error is RoomApiError {
  return error instanceof RoomApiError;
}

export function isRetryableRoomApiError(error: unknown): boolean {
  return error instanceof RoomApiError && error.retryable;
}

function dp(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

interface RequestOptions {
  timeoutMs?: number;
  keepalive?: boolean;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

type RoomApiEnvelope = Omit<RoomApiErrorBody, "ok"> & { ok?: boolean; [key: string]: unknown };

async function readJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (signal.aborted) throw new DOMException("The operation was aborted.", "AbortError");
  return Promise.race([
    response.json(),
    new Promise<never>((_, reject) => {
      const onAbort = () => {
        void response.body?.cancel().catch(() => undefined);
        reject(new DOMException("The operation was aborted.", "AbortError"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }),
  ]);
}

/** `db` — low-level POST helper. */
export async function roomApiRequest<T = RoomApiEnvelope>(
  path: string,
  body: Record<string, unknown>,
  options: RequestOptions = {},
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  let timedOut = false;
  let cancelled = false;
  const timer = setTimeout(() => {
    if (cancelled) return;
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 12_000);
  const onOuterAbort = () => {
    if (timedOut) return;
    cancelled = true;
    controller.abort(options.signal?.reason);
  };
  if (options.signal?.aborted) onOuterAbort();
  else options.signal?.addEventListener("abort", onOuterAbort, { once: true });

  let response: Response;
  let payload: unknown = null;
  try {
    response = await fetchImpl(`${options.baseUrl ?? realtimeHttpBase()}${path}`, {
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(body),
      signal: controller.signal,
      ...(options.keepalive ? { keepalive: true } : {}),
    });
    try {
      payload = await readJson(response, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) throw error;
      payload = null;
    }
  } catch (error) {
    const name =
      error && typeof error === "object" && "name" in error
        ? dp((error as { name?: unknown }).name)
        : null;
    const interrupted = timedOut || cancelled || name === "AbortError" || name === "TimeoutError";
    throw new RoomApiError(
      timedOut
        ? "The room service is taking too long to respond. Try again."
        : cancelled
          ? "The room request was cancelled."
          : interrupted
            ? "The room request was interrupted. Try again."
            : "Could not reach the room service. Try again.",
      {
        status: 0,
        code: timedOut
          ? "room_api_request_timeout"
          : cancelled
            ? "room_api_request_cancelled"
            : interrupted
              ? "room_api_request_interrupted"
              : "room_api_unreachable",
        retryable: !cancelled,
        cause: error,
      },
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onOuterAbort);
  }

  const envelope =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as RoomApiEnvelope)
      : null;

  if (!response.ok || envelope?.ok === false) {
    const code = dp(envelope?.error) ?? "room_api_request_failed";
    const continuation = code === "room_advanced" ? dp(envelope?.continuationRoomCode) : null;
    const status = response.status;
    throw new RoomApiError(
      dp(envelope?.message) ?? dp(envelope?.error) ?? `Room API request failed (${status}).`,
      {
        status,
        code,
        retryable:
          (status === 408 || status === 425 || status === 429 || status >= 500) &&
          envelope?.retryable !== false,
        authRecovery: normalizeAuthRecovery(envelope?.authRecovery),
        ...(continuation ? { continuationRoomCode: continuation } : {}),
      },
    );
  }
  if (!envelope) {
    throw new RoomApiError("The room service returned an invalid response. Try again.", {
      status: response.status,
      code: "invalid_room_api_response",
      retryable: true,
    });
  }
  return envelope as T;
}

/* ------------------------------------------------------------------ coordinator */

/**
 * Operation id for `create_room` — `crypto.randomUUID()` with the original's non-crypto fallback
 * (`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).
 */
export function newOperationId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** `/^[A-Za-z0-9:_-]{8,128}$/` — room creation operation ids. */
export function isValidOperationId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9:_-]{8,128}$/.test(value);
}

export interface CreateRoomRequest {
  /** /^[A-Za-z0-9:_-]{8,128}$/ */
  operationId: string;
  playerName: string;
  playMode: PlayMode;
  matchFormat: MatchFormat;
  roomMode?: "solo_lab" | "single_player" | "multiplayer";
  gameVariant: GameVariant;
  decklist?: string;
  constructedDeckRegistration?: ConstructedDeckRegistration;
  sealedRegistration?: unknown;
  authToken: string;
}

const VALID_PHASES: ReadonlySet<string> = new Set([
  "lobby",
  "sideboarding",
  "battlefield_pick",
  "initiative_roll",
  "mulligan",
  "first_player_choice",
  "in_game",
]);

/** `dh` — POST `/parties/coordinator/global-enam-v1` `create_room`. */
export async function createRoom(
  request: CreateRoomRequest,
  options: RequestOptions = {},
): Promise<CreateRoomResponse> {
  const result = await roomApiRequest<RoomApiEnvelope & Partial<CreateRoomResponse>>(
    "/parties/coordinator/global-enam-v1",
    { action: "create_room", ...request },
    options,
  );
  const phase = result.phase as RoomPhase | undefined;
  const valid =
    (!("phase" in result) || phase === undefined || VALID_PHASES.has(phase)) &&
    "operationId" in result &&
    result.operationId === request.operationId &&
    dp(result.roomCode) !== null &&
    dp(result.playerId) !== null &&
    (!("controlledPlayerIds" in result) ||
      result.controlledPlayerIds === undefined ||
      (Array.isArray(result.controlledPlayerIds) &&
        result.controlledPlayerIds.every((id) => dp(id) !== null)));
  if (!valid) {
    throw new RoomApiError("The room service returned an invalid creation result. Try again.", {
      status: 200,
      code: "invalid_create_room_response",
      retryable: true,
    });
  }
  return result as CreateRoomResponse;
}

/* ------------------------------------------------------------------ match room */

function matchRoomPath(roomCode: string): string {
  return `/parties/match/${encodeURIComponent(roomCode)}`;
}

export interface JoinRoomRequest {
  roomCode: string;
  playerName: string;
  playMode: PlayMode;
  matchFormat: MatchFormat;
  gameVariant?: GameVariant;
  decklist?: string;
  constructedDeckRegistration?: ConstructedDeckRegistration;
  sealedRegistration?: unknown;
  viewerRole?: ViewerRole;
  judgeCallId?: string;
  friendCode?: string;
  authToken: string;
}

/** `dg` — `join_room`. */
export async function joinRoom(
  request: JoinRoomRequest,
  options: RequestOptions = {},
): Promise<JoinRoomResponse> {
  const result = await roomApiRequest<RoomApiEnvelope & Partial<JoinRoomResponse>>(
    matchRoomPath(request.roomCode),
    { action: "join_room", ...request },
    options,
  );
  const codeMatches = dp(result.roomCode)?.toUpperCase() === request.roomCode.trim().toUpperCase();
  const roleValid =
    (result.role === "player" && dp(result.playerId) !== null) ||
    (result.role === "spectator" && dp(result.spectatorName) !== null);
  if (!codeMatches || !roleValid) {
    throw new RoomApiError("The room service returned an invalid join result. Try again.", {
      status: 200,
      code: "invalid_room_api_response",
      retryable: true,
    });
  }
  return result as JoinRoomResponse;
}

export interface SwitchToSpectatorRequest {
  roomCode: string;
  playerId?: string;
  authToken: string;
}

/** `dy` — `switch_to_spectator`. */
export async function switchToSpectator(
  request: SwitchToSpectatorRequest,
  options: RequestOptions = {},
): Promise<{ ok: true; roomCode: string; spectatorName: string }> {
  const result = await roomApiRequest<
    RoomApiEnvelope & { roomCode?: string; spectatorName?: string }
  >(matchRoomPath(request.roomCode), { action: "switch_to_spectator", ...request }, options);
  if (
    dp(result.roomCode)?.toUpperCase() !== request.roomCode.trim().toUpperCase() ||
    dp(result.spectatorName) === null
  ) {
    throw new RoomApiError("The room service returned an invalid spectator result. Try again.", {
      status: 200,
      code: "invalid_room_api_response",
      retryable: true,
    });
  }
  return result as { ok: true; roomCode: string; spectatorName: string };
}

export interface TakeSeatRequest {
  roomCode: string;
  playerId?: string;
  seatIndex?: number;
  authToken: string;
}

/** `dx` — `take_seat`. */
export async function takeSeat(
  request: TakeSeatRequest,
  options: RequestOptions = {},
): Promise<TakeSeatResponse> {
  const result = await roomApiRequest<RoomApiEnvelope & Partial<TakeSeatResponse>>(
    matchRoomPath(request.roomCode),
    { action: "take_seat", ...request },
    options,
  );
  if (
    dp(result.roomCode)?.toUpperCase() !== request.roomCode.trim().toUpperCase() ||
    dp(result.playerId) === null
  ) {
    throw new RoomApiError("The room service returned an invalid seat result. Try again.", {
      status: 200,
      code: "invalid_room_api_response",
      retryable: true,
    });
  }
  return result as TakeSeatResponse;
}

/** `dv` — `resolve_room_membership` (8s timeout by default). */
export async function resolveRoomMembership(
  request: { roomCode: string; authToken: string },
  options: RequestOptions = {},
): Promise<ResolveRoomMembershipResponse> {
  const result = await roomApiRequest<RoomApiEnvelope & Partial<ResolveRoomMembershipResponse>>(
    matchRoomPath(request.roomCode),
    { action: "resolve_room_membership", ...request },
    { ...options, timeoutMs: options.timeoutMs ?? 8_000 },
  );
  const roomCode = request.roomCode.trim().toUpperCase();
  const resolved = dp(result.roomCode)?.toUpperCase();
  const redirectedFrom = dp(result.redirectedFromRoomCode)?.toUpperCase();
  const redirected =
    resolved !== undefined &&
    resolved !== roomCode &&
    redirectedFrom === roomCode &&
    (result.role === "player" || result.role === "spectator");
  const valid =
    ((resolved === roomCode && redirectedFrom === undefined) || redirected) &&
    ((result.role === "absent" && redirectedFrom === undefined) ||
      (result.role === "spectator" && dp(result.spectatorName) !== null) ||
      (result.role === "player" &&
        dp(result.playerId) !== null &&
        dp(result.playerName) !== null &&
        Array.isArray(result.playerIds) &&
        result.playerIds.length > 0 &&
        result.playerIds.every((id) => dp(id) !== null)));
  if (!valid) {
    throw new RoomApiError("The room service returned an invalid membership result. Try again.", {
      status: 200,
      code: "invalid_room_api_response",
      retryable: true,
    });
  }
  return {
    ...(result as ResolveRoomMembershipResponse),
    roomCode: resolved ?? roomCode,
    ...(redirectedFrom === undefined ? {} : { redirectedFromRoomCode: redirectedFrom }),
  };
}

/** `dk` — `create_next_game`. */
export async function createNextGame(
  request: { roomCode: string; authToken: string; [k: string]: unknown },
  options: RequestOptions = {},
): Promise<RoomApiEnvelope> {
  return roomApiRequest(
    matchRoomPath(request.roomCode),
    { action: "create_next_game", ...request },
    options,
  );
}

/** `dw` — `room_series_action`. */
export async function roomSeriesAction(
  request: { roomCode: string; authToken: string; [k: string]: unknown },
  options: RequestOptions = {},
): Promise<RoomApiEnvelope> {
  return roomApiRequest(
    matchRoomPath(request.roomCode),
    { action: "room_series_action", ...request },
    options,
  );
}

/** `d_` — `leave_room` (keepalive). */
export async function leaveRoom(
  request: {
    roomCode: string;
    playerId?: string;
    viewerRole?: ViewerRole;
    authToken: string;
    keepMatchSeat?: boolean;
    requireExactMembership?: boolean;
  },
  options: RequestOptions = {},
): Promise<LeaveRoomResponse> {
  return roomApiRequest<RoomApiEnvelope & LeaveRoomResponse>(
    matchRoomPath(request.roomCode),
    { action: "leave_room", ...request },
    { ...options, keepalive: true },
  );
}

/** `dC` — `abandon_match`. */
export async function abandonMatch(
  request: { roomCode: string; authToken: string; [k: string]: unknown },
  options: RequestOptions = {},
): Promise<void> {
  await roomApiRequest(
    matchRoomPath(request.roomCode),
    { action: "abandon_match", ...request },
    options,
  );
}

/** `dI` — `claim_disconnect_win`. */
export async function claimDisconnectWin(
  request: { roomCode: string; authToken: string; [k: string]: unknown },
  options: RequestOptions = {},
): Promise<void> {
  await roomApiRequest(
    matchRoomPath(request.roomCode),
    { action: "claim_disconnect_win", ...request },
    options,
  );
}

/** `dj` — `return_to_lobby`. */
export async function returnToLobby(
  request: { roomCode: string; authToken: string; [k: string]: unknown },
  options: RequestOptions = {},
): Promise<ReturnToLobbyResponse> {
  const result = await roomApiRequest<RoomApiEnvelope & Partial<ReturnToLobbyResponse>>(
    matchRoomPath(request.roomCode),
    { action: "return_to_lobby", ...request },
    options,
  );
  if (
    dp(result.roomCode)?.toUpperCase() !== request.roomCode.trim().toUpperCase() ||
    dp(result.lobbyRoomCode) === null
  ) {
    throw new RoomApiError("The room service returned an invalid lobby transition. Try again.", {
      status: 200,
      code: "invalid_room_api_response",
      retryable: true,
    });
  }
  return result as ReturnToLobbyResponse;
}

/** `social_target` — `{playerId}` → `{code}`. */
export async function socialTarget(
  request: { roomCode: string; playerId: string; authToken: string },
  options: RequestOptions = {},
): Promise<{ code: string }> {
  return roomApiRequest<RoomApiEnvelope & { code: string }>(
    matchRoomPath(request.roomCode),
    { action: "social_target", playerId: request.playerId, authToken: request.authToken },
    options,
  );
}

/* ------------------------------------------------------------------ matchmaking HTTP */

/** Constructed pools accepted by the client (`C()`). */
export function isConstructedMatchmakingPool(value: unknown): value is string {
  return value === "standard" || value === "upcoming" || value === "origins";
}

/**
 * `st()` — queue room name:
 * `["enam-v2", playMode, playMode === "constructed" ? "all" : matchmakingPool,
 *   gameVariant !== duel ? "multiplayer" : matchFormat].join("-")`.
 */
export function matchmakingQueueRoom(input: {
  playMode: PlayMode;
  matchmakingPool: string;
  matchFormat: MatchFormat;
  gameVariant?: GameVariant | undefined;
}): string {
  return [
    "enam-v2",
    input.playMode,
    input.playMode === "constructed" ? "all" : input.matchmakingPool,
    input.gameVariant !== undefined && input.gameVariant !== "duel"
      ? "multiplayer"
      : input.matchFormat,
  ].join("-");
}

export interface MatchmakingCancelRequest {
  queueRoom: string;
  leaveMatchedRoom?: boolean;
  searchId: string;
  authToken: string;
  [k: string]: unknown;
}

/** `dN` — `cancel_exact` / `reset_exact` on `/parties/matchmaking/<queueRoom>`. */
export async function matchmakingCancelExact(
  request: MatchmakingCancelRequest,
  options: RequestOptions = {},
): Promise<MatchmakingCancelResponse> {
  const { queueRoom, leaveMatchedRoom, ...rest } = request;
  const result = await roomApiRequest<RoomApiEnvelope & Partial<MatchmakingCancelResponse>>(
    `/parties/matchmaking/${encodeURIComponent(queueRoom)}`,
    { action: leaveMatchedRoom ? "reset_exact" : "cancel_exact", ...rest },
    options,
  );
  const shapeOk =
    result.ok === true &&
    "searchId" in result &&
    result.searchId === request.searchId &&
    "status" in result;
  const cancelled = shapeOk && (result.status === "cancelled" || result.status === "expired");
  const matched =
    shapeOk &&
    result.status === "matched" &&
    dp(result.roomCode) !== null &&
    dp(result.playerId) !== null &&
    dp(result.playerName) !== null &&
    (result.playMode === "constructed" || result.playMode === "sealed") &&
    isConstructedMatchmakingPool(result.matchmakingPool) &&
    (result.playMode === "constructed" || result.matchmakingPool !== "origins") &&
    (result.matchFormat === "bo1" || result.matchFormat === "bo3");
  if (!cancelled && !matched) {
    throw new RoomApiError(
      "The matchmaking service returned an invalid cancellation result. Try again.",
      { status: 200, code: "invalid_matchmaking_cancel_response", retryable: true },
    );
  }
  return result as MatchmakingCancelResponse;
}
