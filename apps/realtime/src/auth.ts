/**
 * Guest identity — HS256 JWTs issued by `POST /api/auth/token`, verified wherever the original
 * client passes its account token (`authToken` in room HTTP bodies / realtime frames).
 */

import { SignJWT, jwtVerify } from "jose";
import type { AuthFailureReason } from "@rift/protocol";

export const DEV_AUTH_SECRET = "riftbound-local-dev-secret-do-not-use-in-production";
export const GUEST_TOKEN_TTL_SECONDS = 12 * 60 * 60;

export type IdentityKind = "guest" | "account";

export interface GuestIdentity {
  /** Random player id (guest) or stable account id (account), used as the JWT `sub` claim. */
  sub: string;
  name: string;
  /** Unix seconds; null when the token has no expiry. */
  expiresAt: number | null;
  /** Token flavour; account tokens carry `kind: "account"` and a stable `sub`. */
  kind?: IdentityKind;
}

export type VerifyTokenResult =
  { ok: true; identity: GuestIdentity } | { ok: false; reason: AuthFailureReason };

export function authSecret(envSecret?: string): string {
  const secret = envSecret?.trim();
  return secret && secret.length > 0 ? secret : DEV_AUTH_SECRET;
}

function secretKey(envSecret?: string): Uint8Array {
  return new TextEncoder().encode(authSecret(envSecret));
}

export function newPlayerId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `player_${crypto.randomUUID()}`;
  }
  return `player_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizePlayerName(value: unknown, fallback = "Guest"): string {
  if (typeof value !== "string") return fallback;
  const name = value.trim().replace(/\s+/gu, " ");
  if (name.length === 0) return fallback;
  return name.slice(0, 32);
}

export async function signGuestToken(
  input: { name?: unknown; playerId?: string },
  envSecret?: string,
): Promise<{ token: string; identity: GuestIdentity }> {
  const playerId = input.playerId?.trim() || newPlayerId();
  const name = sanitizePlayerName(input.name);
  const now = Math.floor(Date.now() / 1_000);
  const expiresAt = now + GUEST_TOKEN_TTL_SECONDS;
  const token = await new SignJWT({ name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(playerId)
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(secretKey(envSecret));
  return { token, identity: { sub: playerId, name, expiresAt, kind: "guest" } };
}

export async function verifyAuthToken(
  token: string | null | undefined,
  envSecret?: string,
): Promise<VerifyTokenResult> {
  if (typeof token !== "string" || token.trim().length === 0) {
    return { ok: false, reason: "missing" };
  }
  try {
    const { payload } = await jwtVerify(token, secretKey(envSecret), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || payload.sub.trim().length === 0) {
      return { ok: false, reason: "invalid_claims" };
    }
    const name =
      typeof payload.name === "string" && payload.name.trim().length > 0
        ? sanitizePlayerName(payload.name, "Player")
        : "Player";
    const expiresAt = typeof payload.exp === "number" ? payload.exp : null;
    const kind = payload.kind === "account" ? ("account" as const) : ("guest" as const);
    return { ok: true, identity: { sub: payload.sub, name, expiresAt, kind } };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "JWTExpired") return { ok: false, reason: "expired_token" };
    if (name === "JWTClaimValidationFailed") return { ok: false, reason: "invalid_claims" };
    if (name === "JWSSignatureVerificationFailed")
      return { ok: false, reason: "invalid_signature" };
    if (name === "JWTMalformed" || name === "JWSInvalid" || name === "JWTPayloadFailed") {
      return { ok: false, reason: "malformed_token" };
    }
    return { ok: false, reason: "verification_failed" };
  }
}

/** Best-effort decode of a JWT payload (client parity: no signature check). */
export function decodeTokenClaims(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const normalized = part.replaceAll("-", "+").replaceAll("_", "/");
    const json = globalThis.atob(normalized);
    const bytes = Uint8Array.from(json, (char) => char.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
