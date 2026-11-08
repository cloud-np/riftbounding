/**
 * Better Auth host for the realtime worker.
 *
 * The product owner's `@cloud-np/auth` package wraps Better Auth 1.6.33 (`createCloudAuth`).
 * Mezenta hosts the same package inside its Cloudflare Worker with a D1 database, the Kysely
 * adapter Better Auth picks automatically for D1, and a manual `auth:bootstrap` operator seed.
 * This file mirrors that pattern:
 *
 *  - `/api/auth/*` is served by `auth.handler` from this Worker (`index.ts`).
 *  - Sessions live in the `AUTH_DB` D1 binding (schema in `migrations/0001_better_auth.sql`).
 *  - Sign-in returns Better Auth's session token. The client stores it and sends it as
 *    `authToken` / `Authorization: Bearer`; rooms verify it with `getSession` (bearer plugin).
 *  - Guest HS256 JWTs from `POST /api/auth/token` keep working beside it.
 */

import { createCloudAuth } from "@cloud-np/auth";
import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import {
  sanitizePlayerName,
  verifyAuthToken,
  type GuestIdentity,
  type VerifyTokenResult,
} from "./auth";

/** Development-only Better Auth signing secret. Set `BETTER_AUTH_SECRET` in production. */
export const DEV_BETTER_AUTH_SECRET = "riftbound-local-dev-better-auth-secret-change-me-now";

/** D1 binding plus the env fields the auth host reads. */
export interface AuthEnv {
  AUTH_DB?: D1Database;
  AUTH_SECRET?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  AUTH_TRUSTED_ORIGINS?: string;
  ENVIRONMENT?: string;
  /** Optional production email transport (see docs/AUTH.md). */
  AUTH_EMAIL_WEBHOOK_URL?: string;
  AUTH_EMAIL_WEBHOOK_TOKEN?: string;
}

/** Better Auth accepts a D1 binding directly; the Kysely adapter detects it. */
export type AuthDatabase = NonNullable<BetterAuthOptions["database"]>;

export interface RealtimeAuthOptions {
  database: AuthDatabase;
  baseURL: string;
  secret: string;
  production: boolean;
  trustedOrigins: string[];
  emailWebhookUrl?: string;
  emailWebhookToken?: string;
}

export type RealtimeAuth = ReturnType<typeof createCloudAuth>;

const DEFAULT_DEV_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:3040",
  "http://127.0.0.1:3040",
  "http://localhost:3041",
  "http://127.0.0.1:3041",
  "http://localhost:1999",
  "http://127.0.0.1:1999",
  "https://play.riftatlas.com",
  "https://riftatlas.com",
];

export function isDevelopment(env: AuthEnv): boolean {
  return (env.ENVIRONMENT ?? "development").trim().toLowerCase() !== "production";
}

export function betterAuthSecret(env: AuthEnv): string {
  return env.BETTER_AUTH_SECRET?.trim() || env.AUTH_SECRET?.trim() || DEV_BETTER_AUTH_SECRET;
}

/** Auth base URL. Production must set `BETTER_AUTH_URL` to the public `/api/auth` URL. */
export function authBaseUrl(env: AuthEnv, requestUrl?: string): string {
  const configured = env.BETTER_AUTH_URL?.trim();
  if (configured) return configured.replace(/\/+$/u, "");
  const origin = requestUrl ? new URL(requestUrl).origin : "http://localhost:1999";
  return `${origin}/api/auth`;
}

export function authTrustedOrigins(env: AuthEnv): string[] {
  const configured = (env.AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  // Builders run the play app on several ports (see the e2e scripts); Better Auth supports
  // wildcard origin patterns, so local development trusts any localhost port.
  const devWildcards = isDevelopment(env)
    ? ["http://localhost:*", "http://127.0.0.1:*", "http://[::1]:*"]
    : [];
  return [...new Set([...DEFAULT_DEV_ORIGINS, ...devWildcards, ...configured])];
}

/**
 * Development-only limiter override.
 *
 * `@cloud-np/auth` enables Better Auth's in-memory limiter everywhere and Better Auth's default
 * sign-in/sign-up rule is 3 requests / 10 s / IP. That is correct for production but makes local
 * test suites (and a person switching accounts while developing) hit `429` after a handful of
 * sign-ins. Production keeps the package/default rules untouched; development raises the same
 * per-path buckets to 100 / 10 s. Nothing is disabled and no storage is bypassed.
 */
const DEV_AUTH_RATE_LIMIT: BetterAuthPlugin = {
  id: "rift-dev-auth-rate-limit",
  rateLimit: [
    {
      window: 10,
      max: 100,
      pathMatcher: (path) =>
        path.startsWith("/sign-in") ||
        path.startsWith("/sign-up") ||
        path.startsWith("/change-password") ||
        path.startsWith("/change-email"),
    },
    {
      window: 10,
      max: 100,
      pathMatcher: (path) =>
        path === "/request-password-reset" ||
        path === "/send-verification-email" ||
        path.startsWith("/forget-password") ||
        path.startsWith("/email-otp/"),
    },
  ],
};

/** Build one Better Auth instance. Exported so tests can use an in-memory SQLite database. */
export function createRealtimeAuth(options: RealtimeAuthOptions): RealtimeAuth {
  // Production keeps the package's rate limiter exactly as shipped; development adds the
  // override plugin above (see `DEV_AUTH_RATE_LIMIT`).
  const developmentPlugins: BetterAuthPlugin[] = options.production
    ? []
    : [DEV_AUTH_RATE_LIMIT];
  return createCloudAuth({
    secret: options.secret,
    database: options.database,
    baseURL: options.baseURL,
    trustedOrigins: options.trustedOrigins,
    // The original account dialog lets anyone create an email/password account; the package's
    // `allowedEmails` is an allow-list, so an explicit open policy is the equivalent config.
    allowedEmails: [],
    authorizeEmail: async () => true,
    disableSignUp: false,
    production: options.production,
    plugins: developmentPlugins,
    sendEmail: async (message) => {
      if (!options.production) {
        console.log(`[auth] ${message.subject} -> ${message.email}\n${message.html}`);
        return;
      }
      const url = options.emailWebhookUrl;
      if (!url) throw new Error("Auth email delivery is not configured (AUTH_EMAIL_WEBHOOK_URL).");
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(options.emailWebhookToken
            ? { authorization: `Bearer ${options.emailWebhookToken}` }
            : {}),
        },
        body: JSON.stringify({
          to: message.email,
          name: message.name,
          subject: message.subject,
          html: message.html,
        }),
      });
      if (!response.ok) {
        throw new Error(`Auth email delivery failed (${response.status}).`);
      }
    },
  });
}

const authCache = new WeakMap<object, Map<string, Promise<RealtimeAuth>>>();

/** One Better Auth instance per D1 binding + base URL per isolate (same cache shape as mezenta). */
export function authForEnv(env: AuthEnv, baseURL = authBaseUrl(env)): Promise<RealtimeAuth> {
  const database = env.AUTH_DB;
  if (!database) return Promise.reject(new Error("AUTH_DB is not bound."));
  let instances = authCache.get(database);
  if (!instances) {
    instances = new Map();
    authCache.set(database, instances);
  }
  const secret = betterAuthSecret(env);
  const production = !isDevelopment(env);
  const key = `${baseURL}|${secret}|${production ? "production" : "development"}`;
  let auth = instances.get(key);
  if (!auth) {
    const cache = instances;
    auth = (async () =>
      createRealtimeAuth({
        database,
        baseURL,
        secret,
        production,
        trustedOrigins: authTrustedOrigins(env),
        emailWebhookUrl: env.AUTH_EMAIL_WEBHOOK_URL?.trim() || undefined,
        emailWebhookToken: env.AUTH_EMAIL_WEBHOOK_TOKEN?.trim() || undefined,
      }))().catch((error) => {
      cache.delete(key);
      throw error;
    });
    instances.set(key, auth);
  }
  return auth;
}

/** Resolve a Better Auth session token to the identity shape the room cores use. */
export async function verifyBetterAuthToken(
  token: string,
  env: AuthEnv,
): Promise<GuestIdentity | null> {
  if (!env.AUTH_DB || typeof token !== "string" || token.trim().length === 0) return null;
  try {
    const auth = await authForEnv(env);
    const session = await auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${token.trim()}` }),
    });
    if (!session?.user) return null;
    const rawExpiry = session.session?.expiresAt as unknown;
    const expiresAt =
      rawExpiry instanceof Date
        ? Math.floor(rawExpiry.getTime() / 1_000)
        : typeof rawExpiry === "string" && rawExpiry.trim()
          ? Math.floor(Date.parse(rawExpiry) / 1_000)
          : null;
    const fallbackName = session.user.email?.split("@")[0] ?? "Player";
    return {
      sub: session.user.id,
      name: sanitizePlayerName(session.user.name || fallbackName, "Player"),
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
      kind: "account",
    };
  } catch {
    return null;
  }
}

/**
 * Verify either the clone's guest JWT or a Better Auth session token. Every room HTTP action and
 * every `join_shell` / `join_game` / `resume_game` frame goes through this function.
 */
export async function verifyRealtimeAuthToken(
  token: string | null | undefined,
  env: AuthEnv,
): Promise<VerifyTokenResult> {
  const jwt = await verifyAuthToken(token, env.AUTH_SECRET);
  if (jwt.ok) return jwt;
  if (typeof token === "string" && token.trim().length > 0 && env.AUTH_DB) {
    const identity = await verifyBetterAuthToken(token, env);
    if (identity) return { ok: true, identity };
  }
  return jwt;
}

/** Verifier injected into the room cores (websocket join/resume). */
export function verifierForEnv(env: AuthEnv): (token: string) => Promise<GuestIdentity | null> {
  return async (token: string) => {
    const result = await verifyRealtimeAuthToken(token, env);
    return result.ok ? result.identity : null;
  };
}

function matchesOriginPattern(origin: string, pattern: string): boolean {
  if (!pattern.includes("*")) return origin === pattern;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/gu, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`, "iu").test(origin);
}

function allowedCorsOrigin(request: Request, env: AuthEnv): string | null {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (!origin) return null;
  if (authTrustedOrigins(env).some((pattern) => matchesOriginPattern(origin, pattern))) {
    return origin;
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/iu.test(origin)) return origin;
  if (
    /^https?:\/\/([a-z0-9-]+\.)*(riftatlas\.com|riftatlas-workers\.com|pages\.dev)$/iu.test(origin)
  ) {
    return origin;
  }
  return null;
}

export function withAuthCors(response: Response, request: Request, env: AuthEnv): Response {
  const headers = new Headers(response.headers);
  const origin = allowedCorsOrigin(request, env);
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
    headers.set("vary", "origin");
  }
  headers.set(
    "access-control-allow-headers",
    "content-type,authorization,x-captcha-response,accept-language",
  );
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-expose-headers", "set-auth-token");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function authJson(
  body: Record<string, unknown>,
  status: number,
  request: Request,
  env: AuthEnv,
): Response {
  return withAuthCors(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    }),
    request,
    env,
  );
}

async function signUpEmailFrom(request: Request): Promise<string | null> {
  try {
    const body = (await request.clone().json()) as unknown;
    if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
    const email = (body as Record<string, unknown>).email;
    return typeof email === "string" && email.includes("@") ? email.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Development has no mail transport. After a successful sign-up, mark the new user verified so the
 * account dialog's follow-up sign-in works immediately. Production keeps the package's email
 * verification flow (the verification mail is sent through the configured transport).
 */
async function autoVerifyDevelopmentSignUp(
  email: string | null,
  env: AuthEnv,
  response: Response,
): Promise<void> {
  if (!email || !isDevelopment(env) || !env.AUTH_DB || !response.ok) return;
  try {
    await env.AUTH_DB.prepare(
      'UPDATE "user" SET "emailVerified" = 1, "updatedAt" = ? WHERE lower("email") = ?',
    )
      .bind(new Date().toISOString(), email)
      .run();
  } catch (error) {
    console.warn("[auth] could not auto-verify development sign-up", error);
  }
}

/** `POST/GET /api/auth/*` entry point (Better Auth's own router). */
export async function handleBetterAuthRequest(request: Request, env: AuthEnv): Promise<Response> {
  if (!env.AUTH_DB) {
    return authJson(
      {
        ok: false,
        error: "auth_unavailable",
        message: "The auth database is not configured (AUTH_DB binding missing).",
      },
      503,
      request,
      env,
    );
  }
  try {
    const auth = await authForEnv(env, authBaseUrl(env, request.url));
    // Better Auth's rate limiter keys on x-forwarded-for, which Workers does not set itself.
    // Forward the Cloudflare client IP without trusting a browser-supplied header over it.
    const headers = new Headers(request.headers);
    const clientIp =
      headers.get("cf-connecting-ip") ?? headers.get("x-real-ip") ?? headers.get("x-forwarded-for");
    if (clientIp) headers.set("x-forwarded-for", clientIp);
    const signUpEmail =
      request.method === "POST" && /\/sign-up\/email\/?$/u.test(new URL(request.url).pathname)
        ? await signUpEmailFrom(request)
        : null;
    const response = await auth.handler(new Request(request, { headers }));
    await autoVerifyDevelopmentSignUp(signUpEmail, env, response);
    return withAuthCors(response, request, env);
  } catch (error) {
    return authJson(
      {
        ok: false,
        error: "auth_unavailable",
        message: error instanceof Error ? error.message : "The auth service is unavailable.",
      },
      503,
      request,
      env,
    );
  }
}
