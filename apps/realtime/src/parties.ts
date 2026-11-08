/**
 * partyserver glue.
 *
 * Each party is a Durable Object; all room logic lives in the plain-TS cores. The DOs only:
 *  - resolve the party namespace (`coordinator`, `match`, `matchmaking`) via the binding name,
 *  - inject transport + clock + JWT verification,
 *  - persist the core's serialized state in DO storage,
 *  - forward HTTP/WS events.
 */

import { Server, type Connection, type WSMessage } from "partyserver";
import type { RoomPhase } from "@rift/protocol";
import { parseRealtimeMessage } from "@rift/sync";
import { verifierForEnv, verifyRealtimeAuthToken, type AuthEnv } from "./auth-server";
import { CoordinatorCore, COORDINATOR_ROOM } from "./core/CoordinatorCore";
import { MatchRoomCore, type MatchRoomSerialized } from "./core/MatchRoomCore";
import { TimelinePersistence } from "./core/TimelinePersistence";
import { MatchmakingCore, type MatchmakingSerialized } from "./core/MatchmakingCore";
import { generateRoomCode } from "./core/ids";
import type { CoreTransport, MatchedRoomRequest, MatchRoomSeed } from "./core/types";

export interface Env extends AuthEnv {
  Coordinator: DurableObjectNamespace<Coordinator>;
  Match: DurableObjectNamespace<Match>;
  Matchmaking: DurableObjectNamespace<Matchmaking>;
}

const STATE_KEY = "state";

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type,authorization",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    },
  });
}

function errorBody(
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ok: false, error: code, message, ...extra };
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (!text.trim()) return null;
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function tokenFromRequest(request: Request, body: Record<string, unknown>): string | null {
  if (typeof body.authToken === "string" && body.authToken.trim()) return body.authToken;
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return null;
}

function transportFor(server: Server<Env>): CoreTransport {
  return {
    send(connectionId, message) {
      const connection = server.getConnection(connectionId);
      if (!connection) return;
      try {
        connection.send(JSON.stringify(message));
      } catch {
        // Socket already closing; the close handler will clean up.
      }
    },
    close(connectionId, code, reason) {
      const connection = server.getConnection(connectionId);
      try {
        connection?.close(code, reason);
      } catch {
        // Ignore double-close.
      }
    },
  };
}

function clockFor() {
  return {
    now: () => Date.now(),
    rng: () => Math.random(),
  };
}

function verifyFor(server: Server<Env>) {
  return verifierForEnv((server as unknown as { env: Env }).env);
}

/* ------------------------------------------------------------------ match room */

/** Legacy v1 migration class (kept exported so wrangler can resolve the v1 migration tag). */
export class GameRoom extends Server<Env> {}

export class Match extends Server<Env> {
  private core: MatchRoomCore | null = null;
  private timeline: TimelinePersistence | null = null;
  private loading: Promise<void> | null = null;

  override async onStart(): Promise<void> {
    await this.ensureLoaded();
  }

  private async ensureLoaded(): Promise<void> {
    if (this.core) return;
    if (this.loading) {
      await this.loading;
      return;
    }
    this.loading = (async () => {
      const stored = await this.ctx.storage.get<MatchRoomSerialized>(STATE_KEY);
      const loadedTimeline = await TimelinePersistence.load(this.ctx.storage);
      this.timeline = loadedTimeline.persistence;
      if (stored) {
        this.core = MatchRoomCore.fromSerialized(stored, {
          transport: transportFor(this),
          clock: clockFor(),
          verifyToken: verifyFor(this),
          createLinkedRoom: (linkedSeed) => this.createLinkedRoomInWorker(linkedSeed),
        });
        // v2 history lives in its own keys; legacy room state (pre-B20) carried `timeline`.
        if (loadedTimeline.timeline) this.core.setTimeline(loadedTimeline.timeline);
      }
    })();
    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }

  private async persist(): Promise<void> {
    if (!this.core) return;
    await this.ctx.storage.put(STATE_KEY, this.core.toPersistedState());
    await this.timeline?.save(this.core.timeline);
  }

  /** DO RPC — initialize this room. An existing DO id means the coordinator must retry a code. */
  async createRoom(seed: MatchRoomSeed): Promise<{
    ok: true;
    roomCode: string;
    playerId: string;
    phase: string;
    created: boolean;
  }> {
    await this.ensureLoaded();
    const roomCode = (seed.roomCode || this.name || generateRoomCode()).trim().toUpperCase();
    if (this.core) {
      // Durable Object names are global: an existing object always means the allocated code
      // collided. Returning `created:false` here would silently reuse another room.
      throw Error("room_code_taken");
    }
    const normalizedSeed: MatchRoomSeed = { ...seed, roomCode };
    this.core = await MatchRoomCore.create(normalizedSeed, {
      transport: transportFor(this),
      clock: clockFor(),
      verifyToken: verifyFor(this),
      createLinkedRoom: (linkedSeed) => this.createLinkedRoomInWorker(linkedSeed),
    });
    await this.persist();
    return {
      ok: true,
      roomCode,
      playerId: seed.players[0]?.playerId ?? "",
      phase: this.core.phase,
      created: true,
    };
  }

  /** Allocate a linked room (next game / rematch / return-to-lobby) through the coordinator. */
  private async createLinkedRoomInWorker(seed: MatchRoomSeed): Promise<{ roomCode: string }> {
    const stub = this.env.Coordinator.get(this.env.Coordinator.idFromName(COORDINATOR_ROOM));
    return stub.createLinkedRoom(seed);
  }

  override async onConnect(connection: Connection, ctx: { request: Request }): Promise<void> {
    await this.ensureLoaded();
    if (!this.core) {
      connection.send(
        JSON.stringify({
          type: "error",
          gameInstanceId: this.name,
          code: "room_not_found",
          message: "Room not found.",
          retryable: false,
        }),
      );
      connection.close(4008, "Room is unavailable");
      return;
    }
    const url = new URL(connection.uri ?? ctx.request.url);
    this.core.addConnection(connection.id, {
      playerId: url.searchParams.get("playerId"),
      roomCode: url.searchParams.get("roomCode"),
    });
  }

  override async onMessage(connection: Connection, message: WSMessage): Promise<void> {
    await this.ensureLoaded();
    if (!this.core) return;
    if (typeof message !== "string") {
      connection.send(
        JSON.stringify({
          type: "error",
          gameInstanceId: this.name,
          code: "invalid_message",
          message: "Only JSON string messages are supported.",
          retryable: false,
        }),
      );
      return;
    }
    const parsed = parseRealtimeMessage(message);
    if (!parsed) {
      connection.send(
        JSON.stringify({
          type: "error",
          gameInstanceId: this.name,
          code: "invalid_message",
          message: "Could not parse the realtime message.",
          retryable: false,
        }),
      );
      return;
    }
    await this.core.handleMessage(connection.id, parsed);
    await this.persist();
  }

  override async onClose(connection: Connection): Promise<void> {
    if (!this.core) return;
    this.core.removeConnection(connection.id);
    await this.persist();
  }

  override async onRequest(request: Request): Promise<Response> {
    if (request.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "content-type,authorization",
          "access-control-allow-methods": "GET,POST,OPTIONS",
        },
      });
    if (request.method !== "POST") {
      return jsonResponse(
        errorBody("invalid_room_request", "Room API actions must use POST."),
        405,
      );
    }
    await this.ensureLoaded();
    if (!this.core) {
      return jsonResponse(errorBody("room_not_found", "Room not found."), 404);
    }
    const body = await readJsonBody(request);
    if (!body) {
      return jsonResponse(
        errorBody("invalid_room_request", "The request body must be valid JSON."),
        400,
      );
    }
    const action = typeof body.action === "string" ? body.action : "";
    if (!action) {
      return jsonResponse(
        errorBody("invalid_room_request", "A valid room API action is required."),
        400,
      );
    }
    const token = tokenFromRequest(request, body);
    const verified = await verifyRealtimeAuthToken(token, this.env);
    if (!verified.ok) {
      return jsonResponse(
        errorBody("auth_token_rejected", "Your session token could not be verified.", {
          authReason: verified.reason,
          authRecovery: verified.reason === "expired_token" ? "refresh_token" : "reauthenticate",
        }),
        401,
      );
    }
    const result = await this.core.handleHttp(action, body, verified.identity);
    await this.persist();
    return jsonResponse(result.body, result.status);
  }
}

/* ------------------------------------------------------------------ coordinator */

export class Coordinator extends Server<Env> {
  private core: CoordinatorCore | null = null;
  private loading: Promise<void> | null = null;

  override async onStart(): Promise<void> {
    await this.ensureLoaded();
  }

  private async ensureLoaded(): Promise<void> {
    if (this.core) return;
    if (this.loading) {
      await this.loading;
      return;
    }
    this.loading = (async () => {
      const stored =
        await this.ctx.storage.get<ReturnType<CoordinatorCore["toSerialized"]>>(STATE_KEY);
      this.core = stored
        ? CoordinatorCore.fromSerialized(stored, {
            clock: clockFor(),
            createMatchRoom: (seed) => this.createMatchRoomInWorker(seed),
          })
        : new CoordinatorCore({
            clock: clockFor(),
            createMatchRoom: (seed) => this.createMatchRoomInWorker(seed),
          });
    })();
    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }

  private async persist(): Promise<void> {
    if (!this.core) return;
    await this.ctx.storage.put(STATE_KEY, this.core.toSerialized());
  }

  private async createMatchRoomInWorker(seed: MatchRoomSeed): Promise<{
    roomCode: string;
    phase?: RoomPhase;
    created: boolean;
  }> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const roomCode = generateRoomCode();
      seed.roomCode = roomCode;
      const stub = this.env.Match.get(this.env.Match.idFromName(roomCode));
      try {
        const response = await stub.createRoom(seed);
        if (!response.created) {
          // The DO was already initialized under this name (collision); try a new code.
          lastError = Error("room_code_taken");
          continue;
        }
        return {
          roomCode: response.roomCode,
          phase: response.phase as RoomPhase,
          created: response.created,
        };
      } catch (error) {
        lastError = error;
        if (error instanceof Error && error.message.includes("room_code_taken")) continue;
        throw error;
      }
    }
    throw lastError instanceof Error ? lastError : Error("Could not allocate a room code.");
  }

  /** Internal RPC for the matchmaking queue. */
  async createMatchedRoom(
    request: MatchedRoomRequest,
  ): Promise<{ roomCode: string; playerIds: string[] }> {
    await this.ensureLoaded();
    if (!this.core) throw Error("coordinator not initialized");
    const created = await this.core.createMatchedRoom(request);
    await this.persist();
    return created;
  }

  /** Internal RPC for linked rooms (next game, rematch, return-to-lobby). */
  async createLinkedRoom(seed: MatchRoomSeed): Promise<{ roomCode: string }> {
    await this.ensureLoaded();
    if (!this.core) throw Error("coordinator not initialized");
    const created = await this.core.createLinkedRoom(seed);
    await this.persist();
    return created;
  }

  override async onConnect(connection: Connection): Promise<void> {
    connection.close(4008, "The coordinator only accepts HTTP requests");
  }

  override async onRequest(request: Request): Promise<Response> {
    if (request.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "content-type,authorization",
          "access-control-allow-methods": "GET,POST,OPTIONS",
        },
      });
    if (request.method !== "POST") {
      return jsonResponse(
        errorBody("invalid_room_request", "Room API actions must use POST."),
        405,
      );
    }
    await this.ensureLoaded();
    if (!this.core) {
      return jsonResponse(
        errorBody("room_service_unavailable", "The coordinator is not available."),
        503,
      );
    }
    const body = await readJsonBody(request);
    if (!body) {
      return jsonResponse(
        errorBody("invalid_room_request", "The request body must be valid JSON."),
        400,
      );
    }
    const action = typeof body.action === "string" ? body.action : "";
    if (action !== "create_room") {
      return jsonResponse(
        errorBody("unsupported_action", "This coordinator action is not supported."),
        400,
      );
    }
    const token = tokenFromRequest(request, body);
    const verified = await verifyRealtimeAuthToken(token, this.env);
    if (!verified.ok) {
      return jsonResponse(
        errorBody("auth_token_rejected", "Your session token could not be verified.", {
          authReason: verified.reason,
          authRecovery: verified.reason === "expired_token" ? "refresh_token" : "reauthenticate",
        }),
        401,
      );
    }
    const result = await this.core.createRoom(body, verified.identity);
    await this.persist();
    return jsonResponse(result.body, result.status);
  }
}

/* ------------------------------------------------------------------ matchmaking */

export class Matchmaking extends Server<Env> {
  private core: MatchmakingCore | null = null;
  private loading: Promise<void> | null = null;

  override async onStart(): Promise<void> {
    await this.ensureLoaded();
    await this.scheduleAlarm();
  }

  private async ensureLoaded(): Promise<void> {
    if (this.core) return;
    if (this.loading) {
      await this.loading;
      return;
    }
    this.loading = (async () => {
      const stored = await this.ctx.storage.get<MatchmakingSerialized>(STATE_KEY);
      this.core = stored
        ? MatchmakingCore.fromSerialized(stored, {
            clock: clockFor(),
            transport: transportFor(this),
            verifyToken: verifyFor(this),
            createMatchedRoom: (request) => this.createMatchedRoomInWorker(request),
          })
        : new MatchmakingCore({
            clock: clockFor(),
            transport: transportFor(this),
            verifyToken: verifyFor(this),
            createMatchedRoom: (request) => this.createMatchedRoomInWorker(request),
          });
    })();
    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }

  private async persist(): Promise<void> {
    if (!this.core) return;
    await this.ctx.storage.put(STATE_KEY, this.core.toSerialized());
    await this.scheduleAlarm();
  }

  private async scheduleAlarm(): Promise<void> {
    if (!this.core) return;
    const next = this.core.nextAlarmAt();
    if (next === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const current = await this.ctx.storage.getAlarm();
    if (current === null || Math.abs(current - next) > 1_000) {
      await this.ctx.storage.setAlarm(next);
    }
  }

  private async createMatchedRoomInWorker(request: MatchedRoomRequest): Promise<{
    roomCode: string;
    playerIds: [string, string];
  }> {
    const stub = this.env.Coordinator.get(this.env.Coordinator.idFromName(COORDINATOR_ROOM));
    const created = await stub.createMatchedRoom(request);
    return {
      roomCode: created.roomCode,
      playerIds: [created.playerIds[0] ?? "", created.playerIds[1] ?? ""],
    };
  }

  override async onConnect(connection: Connection): Promise<void> {
    await this.ensureLoaded();
    this.core?.addConnection(connection.id);
  }

  override async onMessage(connection: Connection, message: WSMessage): Promise<void> {
    await this.ensureLoaded();
    if (!this.core) return;
    if (typeof message !== "string") {
      connection.send(
        JSON.stringify({
          type: "error",
          code: "invalid_message",
          message: "Only JSON string messages are supported.",
          retryable: false,
        }),
      );
      return;
    }
    let parsed: Record<string, unknown> | null = null;
    try {
      const value: unknown = JSON.parse(message);
      parsed =
        typeof value === "object" && value !== null && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : null;
    } catch {
      parsed = null;
    }
    if (!parsed || typeof parsed.type !== "string") {
      connection.send(
        JSON.stringify({
          type: "error",
          code: "invalid_message",
          message: "The matchmaking message is malformed.",
          retryable: false,
        }),
      );
      return;
    }
    await this.core.handleMessage(connection.id, parsed);
    await this.persist();
  }

  override async onClose(connection: Connection): Promise<void> {
    if (!this.core) return;
    this.core.removeConnection(connection.id);
    await this.persist();
  }

  override async onAlarm(): Promise<void> {
    await this.ensureLoaded();
    if (!this.core) return;
    this.core.expire(Date.now());
    await this.persist();
  }

  override async onRequest(request: Request): Promise<Response> {
    if (request.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "content-type,authorization",
          "access-control-allow-methods": "GET,POST,OPTIONS",
        },
      });
    if (request.method !== "POST") {
      return jsonResponse(
        errorBody("invalid_room_request", "Matchmaking actions must use POST."),
        405,
      );
    }
    await this.ensureLoaded();
    if (!this.core) {
      return jsonResponse(errorBody("matchmaking_failed", "Matchmaking is unavailable."), 503);
    }
    const body = await readJsonBody(request);
    if (!body) {
      return jsonResponse(
        errorBody("invalid_room_request", "The request body must be valid JSON."),
        400,
      );
    }
    const action = typeof body.action === "string" ? body.action : "";
    const token = tokenFromRequest(request, body);
    const verified = await verifyRealtimeAuthToken(token, this.env);
    if (!verified.ok) {
      return jsonResponse(
        errorBody("invalid_auth_token", "Your session token could not be verified.", {
          authRecovery: "refresh_token",
          retryable: true,
        }),
        401,
      );
    }
    const result = await this.core.handleHttp(action, body, verified.identity);
    await this.persist();
    return jsonResponse(result.body, result.status);
  }
}
