/**
 * Client auth adapter.
 *
 * Guest tokens are the original clone contract: `POST /api/auth/token` returns an HS256 JWT,
 * decoded locally for identity, cached in localStorage (module 541363 in the recon bundles).
 *
 * Accounts are now the product owner's `@cloud-np/auth` client (`createCloudAuthClient`, Better
 * Auth 1.6.33). Sign-in posts to `/api/auth/sign-in/email` through that client, and the session
 * token it returns is persisted and sent to the realtime worker as `authToken` (the worker
 * verifies it with `getSession`). Better Auth session tokens are opaque, so the account's
 * display identity is persisted alongside the token.
 *
 * "Continue as guest" is unchanged and always wins over a stored account session.
 */

import { createCloudAuthClient } from "@cloud-np/auth/client";
import { STORAGE_KEYS, authBase } from "./config";

export interface AuthTokenErrorShape {
  status: number;
  code: string;
  message: string;
  retryAfter?: number;
}

export class AuthTokenError extends Error implements AuthTokenErrorShape {
  readonly status: number;
  readonly code: string;
  readonly retryAfter?: number;

  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(message);
    this.name = "AuthTokenError";
    this.status = status;
    this.code = code;
    if (retryAfter !== undefined) this.retryAfter = retryAfter;
  }
}

export interface TokenIdentity {
  /** JWT `sub` (account/user id). */
  subject: string | null;
  /** JWT `name` claim (display name) when present. */
  name: string | null;
  /** JWT `exp` (seconds) when present. */
  expiresAt: number | null;
  /** Guest JWT or a Better Auth account session. */
  kind: "guest" | "account";
}

/** `541363.T` — decode a JWT payload without verifying the signature (client only). */
export function decodeTokenPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("Invalid account token");
  const decoded = atob(payload.replaceAll("-", "+").replaceAll("_", "/"));
  const json = JSON.parse(
    new TextDecoder().decode(Uint8Array.from(decoded, (c) => c.charCodeAt(0))),
  ) as unknown;
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("Invalid account token");
  }
  return json as Record<string, unknown>;
}

export function identityFromToken(token: string | null): TokenIdentity {
  if (!token) return { subject: null, name: null, expiresAt: null, kind: "guest" };
  try {
    const claims = decodeTokenPayload(token);
    const sub = typeof claims.sub === "string" ? claims.sub : null;
    const name = typeof claims.name === "string" ? claims.name : null;
    const exp = typeof claims.exp === "number" && Number.isFinite(claims.exp) ? claims.exp : null;
    const kind = claims.kind === "account" ? "account" : "guest";
    return { subject: sub, name, expiresAt: exp, kind };
  } catch {
    return { subject: null, name: null, expiresAt: null, kind: "guest" };
  }
}

export function isTokenExpired(token: string, now: number = Date.now()): boolean {
  const { expiresAt } = identityFromToken(token);
  if (expiresAt === null) return false;
  return expiresAt * 1000 <= now;
}

/* ------------------------------------------------------------------ storage */

function safeStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

interface StoredAccountSession {
  token: string;
  identity: {
    subject: string | null;
    name: string;
    kind: "account";
  };
}

function readJson<T>(key: string): T | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown | null): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function readStoredGuestToken(): string | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const token = storage.getItem(STORAGE_KEYS.guestToken);
    if (!token) return null;
    if (isTokenExpired(token)) {
      storage.removeItem(STORAGE_KEYS.guestToken);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function readStoredAccountSession(): StoredAccountSession | null {
  const session = readJson<StoredAccountSession>(STORAGE_KEYS.accountSession);
  if (!session || typeof session.token !== "string" || !session.token) return null;
  const name = typeof session.identity?.name === "string" ? session.identity.name.trim() : "";
  if (!name) return null;
  return {
    token: session.token,
    identity: {
      subject: typeof session.identity.subject === "string" ? session.identity.subject : null,
      name,
      kind: "account",
    },
  };
}

function storeAccountSession(session: StoredAccountSession): void {
  writeJson(STORAGE_KEYS.accountSession, session);
}

/** Guest-token writer (kept under the original name for existing callers/tests). */
export function storeToken(token: string | null): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    if (token) storage.setItem(STORAGE_KEYS.guestToken, token);
    else storage.removeItem(STORAGE_KEYS.guestToken);
  } catch {
    /* ignore quota / privacy mode */
  }
}

/** Current token: a signed-in account session wins over the cached guest token. */
export function readStoredToken(): string | null {
  const account = readStoredAccountSession();
  if (account) return account.token;
  return readStoredGuestToken();
}

export function clearStoredToken(): void {
  storeToken(null);
  writeJson(STORAGE_KEYS.accountSession, null);
}

/* ------------------------------------------------------------------ guest token endpoint */

interface FetchTokenOptions {
  /** bypass the cached token and hit the endpoint */
  skipCache?: boolean;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/**
 * `541363.o("token")` — POST the token endpoint. Direct origin first when configured; on a
 * network error retry same-origin with `x-account-auth-fallback: 1`.
 */
export async function requestAuthToken(options: FetchTokenOptions = {}): Promise<string | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const directOrigin = (process.env.NEXT_PUBLIC_ACCOUNT_AUTH_DIRECT_ORIGIN ?? "").trim();

  const attempt = async (useDirectOrigin: boolean): Promise<Response> => {
    const base = useDirectOrigin && directOrigin ? directOrigin.replace(/\/+$/, "") : authBase();
    return fetchImpl(`${base}/api/auth/token`, {
      method: "POST",
      credentials: useDirectOrigin ? "include" : "same-origin",
      cache: "no-store",
      signal: options.signal ?? AbortSignal.timeout(15_000),
      headers: useDirectOrigin
        ? { "content-type": "text/plain;charset=UTF-8" }
        : {
            "content-type": "text/plain;charset=UTF-8",
            "x-account-auth-fallback": "1",
          },
      body: JSON.stringify({ name: readStoredGuestName() || undefined }),
    });
  };

  let response: Response;
  if (directOrigin) {
    try {
      response = await attempt(true);
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      response = await attempt(false);
    }
  } else {
    response = await attempt(false);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      code?: string;
      error?: string;
      message?: string;
    } | null;
    const retryAfterHeader = Number(response.headers.get("retry-after"));
    throw new AuthTokenError(
      response.status,
      body?.code ?? body?.error ?? "request_failed",
      body?.message ?? "Sign-in service unavailable",
      Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader : undefined,
    );
  }
  const body = (await response.json().catch(() => null)) as { token?: unknown } | null;
  return typeof body?.token === "string" ? body.token : null;
}

/**
 * `getAuthToken()` used by the match runtime. Resolves the account session first, otherwise the
 * cached guest token, otherwise a fresh guest token.
 */
export async function getAuthToken(options: FetchTokenOptions = {}): Promise<string | null> {
  const account = readStoredAccountSession();
  if (account) return account.token;
  if (!options.skipCache) {
    const cached = readStoredGuestToken();
    if (cached) return cached;
  }
  const token = await requestAuthToken(options);
  if (token) storeToken(token);
  return token;
}

/* ------------------------------------------------------------------ Better Auth accounts */

export class AccountAuthError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AccountAuthError";
    this.status = status;
    this.code = code;
  }
}

/** Better Auth accounts are email/password; the clone's form accepts the dev username shortcut. */
export function accountEmailFor(identifier: string): string {
  const trimmed = identifier.trim();
  if (!trimmed) return "";
  return trimmed.includes("@") ? trimmed.toLowerCase() : `${trimmed.toLowerCase()}@local.test`;
}

type CloudAuthClient = ReturnType<typeof createCloudAuthClient>;

let cachedClient: CloudAuthClient | null = null;
let cachedClientBase = "";

function cloudAuthClient(): CloudAuthClient {
  const base = authBase();
  if (!cachedClient || cachedClientBase !== base) {
    cachedClient = createCloudAuthClient(base);
    cachedClientBase = base;
  }
  return cachedClient;
}

interface CloudSignInData {
  token?: unknown;
  user?: {
    id?: unknown;
    name?: unknown;
    email?: unknown;
  };
}

interface CloudSignInResult {
  data?: CloudSignInData | null;
  error?: {
    status?: number;
    code?: string;
    message?: string;
  } | null;
}

function errorMessage(error: { message?: string } | null | undefined): string {
  const message = error?.message?.trim();
  return message && message.length > 0 ? message : "Sign-in failed. Try again.";
}

async function signInThroughCloudAuth(
  identifier: string,
  password: string,
): Promise<{ token: string; identity: TokenIdentity; displayName: string }> {
  const email = accountEmailFor(identifier);
  if (!email || !password) {
    throw new AccountAuthError(400, "invalid_request", "Enter your username and password.");
  }
  const client = cloudAuthClient();
  const result = (await client.signIn.email({
    email,
    password,
    rememberMe: true,
  })) as CloudSignInResult;
  if (result.error) {
    throw new AccountAuthError(
      result.error.status ?? 401,
      result.error.code ?? "invalid_credentials",
      errorMessage(result.error),
    );
  }
  const data = result.data;
  if (!data || typeof data.token !== "string" || data.token.length === 0) {
    throw new AccountAuthError(
      502,
      "invalid_auth_response",
      "The sign-in service returned an invalid session.",
    );
  }
  const user = data.user ?? {};
  const subject = typeof user.id === "string" ? user.id : null;
  const emailName =
    typeof user.email === "string" && user.email.includes("@")
      ? user.email.slice(0, user.email.indexOf("@"))
      : email.slice(0, email.indexOf("@"));
  const displayName =
    typeof user.name === "string" && user.name.trim() ? user.name.trim() : emailName;
  storeAccountSession({
    token: data.token,
    identity: { subject, name: displayName, kind: "account" },
  });
  return {
    token: data.token,
    identity: { subject, name: displayName, expiresAt: null, kind: "account" },
    displayName,
  };
}

/** Sign in through `createCloudAuthClient` and persist the Better Auth session token. */
export async function loginWithPassword(
  identifier: string,
  password: string,
  _fetchImpl: typeof fetch = fetch,
): Promise<{ token: string; identity: TokenIdentity }> {
  const { token, identity } = await signInThroughCloudAuth(identifier, password);
  return { token, identity };
}

/**
 * Create a better-auth account. The worker enables sign-up (`disableSignUp: false`); in local
 * development it auto-verifies the address, so the sign-up response may not carry a session. In
 * that case sign in immediately (production shows the verification-mail instruction instead).
 */
export async function registerAccount(
  identifier: string,
  password: string,
  _fetchImpl: typeof fetch = fetch,
): Promise<{ token: string; identity: TokenIdentity }> {
  const email = accountEmailFor(identifier);
  if (!email || !password) {
    throw new AccountAuthError(400, "invalid_request", "Enter a username and password.");
  }
  const client = cloudAuthClient();
  const result = (await client.signUp.email({
    email,
    password,
    name: identifier.trim() || email.slice(0, email.indexOf("@")),
  })) as CloudSignInResult;
  if (result.error) {
    throw new AccountAuthError(
      result.error.status ?? 400,
      result.error.code ?? "sign_up_disabled",
      errorMessage(result.error),
    );
  }
  const data = result.data;
  if (!data || typeof data.token !== "string" || data.token.length === 0) {
    try {
      // Development auto-verifies the new account, so this succeeds immediately.
      return await signInThroughCloudAuth(identifier, password);
    } catch (signInError) {
      const message =
        signInError instanceof Error && signInError.message.trim()
          ? signInError.message
          : "Account created, but signing in failed. Try again.";
      throw new AccountAuthError(
        403,
        "email_verification_required",
        `Account created. Check your email to verify it, then sign in. (${message})`,
      );
    }
  }
  const user = data.user ?? {};
  const subject = typeof user.id === "string" ? user.id : null;
  const displayName =
    typeof user.name === "string" && user.name.trim()
      ? user.name.trim()
      : email.slice(0, email.indexOf("@"));
  storeAccountSession({
    token: data.token,
    identity: { subject, name: displayName, kind: "account" },
  });
  return {
    token: data.token,
    identity: { subject, name: displayName, expiresAt: null, kind: "account" },
  };
}

/** End the Better Auth session (bearer) and clear every locally stored token. */
export function signOutAccount(fetchImpl: typeof fetch = fetch): void {
  const account = readStoredAccountSession();
  clearStoredToken();
  if (!account) return;
  void fetchImpl(`${authBase()}/api/auth/sign-out`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    keepalive: true,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${account.token}`,
    },
    body: "{}",
  }).catch(() => {
    /* Local sign-out still succeeds when the auth service is down. */
  });
}

/* ------------------------------------------------------------------ identity */

export interface GuestIdentity {
  /** stable account subject (JWT `sub`) */
  subject: string | null;
  /** display name (JWT `name`, falls back to the locally stored guest name) */
  name: string;
  /** signed-in account vs local guest chrome */
  kind: "guest" | "account";
}

export function readStoredGuestName(): string {
  const storage = safeStorage();
  try {
    const stored = storage?.getItem(STORAGE_KEYS.guestName);
    if (stored && stored.trim()) return stored.trim();
    const legacy = storage?.getItem(STORAGE_KEYS.playerName);
    if (legacy && legacy.trim()) return legacy.trim();
  } catch {
    /* ignore */
  }
  return "";
}

export function storeGuestName(name: string): void {
  const storage = safeStorage();
  try {
    storage?.setItem(STORAGE_KEYS.guestName, name);
  } catch {
    /* ignore */
  }
}

/** Resolve the current identity from the stored account session + guest token/name. */
export function resolveIdentity(): GuestIdentity {
  const account = readStoredAccountSession();
  if (account) {
    return {
      subject: account.identity.subject,
      name: account.identity.name,
      kind: "account",
    };
  }
  const token = readStoredGuestToken();
  const { subject, name } = identityFromToken(token);
  const storedName = readStoredGuestName();
  return {
    subject,
    name: storedName || (name && name.trim()) || "Player",
    kind: "guest",
  };
}
