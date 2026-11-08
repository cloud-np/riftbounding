/**
 * Realtime worker entry (port 1999 in development).
 *
 * - `POST /api/auth/token` → HS256 guest JWT `{sub: player id, name}` (jose; `AUTH_SECRET` env).
 * - `/api/auth/*` → Better Auth (`@cloud-np/auth`, D1 `AUTH_DB`). Email/password sessions are
 *   bearer tokens that the room cores accept alongside guest JWTs.
 * - `/parties/coordinator/global-enam-v1` → room creation (matched to the original URL scheme).
 * - `/parties/match/<ROOM_CODE>` → match room HTTP + websocket (party `match`).
 * - `/parties/matchmaking/<queueRoom>` → matchmaking HTTP + websocket.
 */

import { routePartykitRequest } from "partyserver";
import { signGuestToken } from "./auth";
import { handleBetterAuthRequest } from "./auth-server";
import { handleDecksRequest } from "./decks";
import { engineKind } from "./engine-adapter";
import { GameRoom, Match, Matchmaking, Coordinator } from "./parties";
import type { Env } from "./parties";

export { GameRoom, Match, Matchmaking, Coordinator };

const ALLOWED_HEADERS =
  "content-type,authorization,x-captcha-response,accept-language,x-account-auth-fallback";

/**
 * CORS for browser clients. Reflect localhost/private dev origins (any port) and Rift Atlas
 * origins, otherwise stay permissive for the local clone. The room API uses `text/plain` simple
 * requests, but auth endpoints send JSON and therefore need a real preflight response.
 */
function corsHeaders(request?: Request): Record<string, string> {
  const origin = request?.headers.get("origin")?.trim() ?? "";
  const reflected =
    origin.length > 0 &&
    (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/iu.test(origin) ||
      /^https?:\/\/([a-z0-9-]+\.)*(riftatlas\.com|riftatlas-workers\.com|pages\.dev)$/iu.test(
        origin,
      ));
  return {
    "access-control-allow-origin": reflected ? origin : "*",
    "access-control-allow-headers": ALLOWED_HEADERS,
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-expose-headers": "set-auth-token",
    ...(reflected ? { vary: "origin", "access-control-allow-credentials": "true" } : {}),
  };
}

function json(body: Record<string, unknown>, status = 200, request?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders(request) },
  });
}

function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

async function readJsonBody(
  request: Request,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }> {
  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      } else {
        return {
          ok: false,
          response: json(
            {
              ok: false,
              error: "invalid_json",
              message: "The request body must be a JSON object.",
            },
            400,
            request,
          ),
        };
      }
    }
  } catch {
    return {
      ok: false,
      response: json(
        { ok: false, error: "invalid_json", message: "The request body must be valid JSON." },
        400,
        request,
      ),
    };
  }
  return { ok: true, body };
}

async function handleAuthToken(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") return preflight(request);
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed", message: "Use POST." }, 405, request);
  }
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const signed = await signGuestToken({ name: parsed.body.name }, env.AUTH_SECRET);
  return json(
    {
      ok: true,
      token: signed.token,
      playerId: signed.identity.sub,
      name: signed.identity.name,
      kind: "guest",
      expiresAt: signed.identity.expiresAt,
    },
    200,
    request,
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/auth/token") {
      return handleAuthToken(request, env);
    }
    if (request.method === "OPTIONS") {
      return preflight(request);
    }
    if (url.pathname === "/api/auth" || url.pathname.startsWith("/api/auth/")) {
      return handleBetterAuthRequest(request, env);
    }
    if (url.pathname === "/api/decks" || url.pathname.startsWith("/api/decks/")) {
      return (await handleDecksRequest(request, env)) ?? json(
        { ok: false, error: "not_found", message: "This deck route does not exist." },
        404,
        request,
      );
    }
    if (url.pathname === "/api/version") {
      return json({ version: "dev", build: "local", environment: "development" }, 200, request);
    }
    if (url.pathname === "/api/health") {
      return json({ ok: true, engine: await engineKind(), now: Date.now() }, 200, request);
    }
    if (url.pathname === "/" || url.pathname === "") {
      return json({ ok: true, service: "rift-realtime", party: "match" }, 200, request);
    }
    const partyResponse = await routePartykitRequest(request, env);
    if (partyResponse) return partyResponse;
    return json(
      {
        ok: false,
        error: "not_found",
        message: "This route does not exist on the realtime service.",
      },
      404,
      request,
    );
  },
} satisfies ExportedHandler<Env>;
