/**
 * Integration coverage for the @cloud-np/auth integration:
 *  - the dev seed is idempotent and accepts atlas / 1234 (even though 1234 is shorter than the
 *    package's sign-up minimum, since the seed writes a verified credential directly),
 *  - wrong passwords are rejected,
 *  - Better Auth session tokens verify as account identities for realtime,
 *  - guest JWTs still verify,
 *  - the verified identity works for coordinator create_room and a room join_shell frame.
 *
 * The production worker gets a D1 binding; tests use the same Better Auth/Kysely path with
 * node:sqlite (Better Auth auto-detects DatabaseSync), so no workerd instance is needed.
 */

/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hashPassword } from "better-auth/crypto";
import type { RoomPhase } from "@rift/protocol";
import { signGuestToken } from "../src/auth";
import {
  createRealtimeAuth,
  verifyRealtimeAuthToken,
  verifierForEnv,
  type AuthDatabase,
  type AuthEnv,
} from "../src/auth-server";
import { CoordinatorCore } from "../src/core/CoordinatorCore";
import { MatchRoomCore } from "../src/core/MatchRoomCore";
import type { CoreTransport, MatchRoomSeed } from "../src/core/types";
import { buildDevAuthSeedStatements } from "../src/dev-account";

const SECRET = "test-better-auth-secret-at-least-32-characters-long";
const BASE_URL = "http://localhost:1999/api/auth";
const schemaSql = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../migrations/0001_better_auth.sql"),
  "utf8",
);

function freshDatabase(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(schemaSql);
  return db;
}

async function seedDevAccount(db: DatabaseSync): Promise<void> {
  const statements = buildDevAuthSeedStatements({
    passwordHash: await hashPassword("1234"),
    now: new Date().toISOString(),
  });
  for (const statement of statements) db.exec(statement);
}

function testEnv(db: DatabaseSync): AuthEnv {
  return {
    AUTH_DB: db as unknown as D1Database,
    AUTH_SECRET: SECRET,
    BETTER_AUTH_SECRET: SECRET,
    BETTER_AUTH_URL: BASE_URL,
    ENVIRONMENT: "development",
  };
}

function testAuth(env: AuthEnv) {
  return createRealtimeAuth({
    database: env.AUTH_DB as unknown as AuthDatabase,
    baseURL: BASE_URL,
    secret: SECRET,
    production: false,
    trustedOrigins: ["http://localhost:3000"],
  });
}

interface SignInBody {
  token?: string;
  user?: { id: string; email: string; name: string };
  code?: string;
  message?: string;
}

/**
 * Better Auth's default in-memory rate limiter is module-global and allows three sign-ins per
 * window per IP, so each test uses a distinct forwarded address (the worker does the same with
 * `cf-connecting-ip`).
 */
let signInIp = 1;

async function signIn(
  env: AuthEnv,
  email: string,
  password: string,
): Promise<{ status: number; body: SignInBody }> {
  const auth = testAuth(env);
  signInIp += 1;
  const response = await auth.handler(
    new Request(`${BASE_URL}/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        "x-forwarded-for": `10.0.${Math.floor(signInIp / 250)}.${signInIp % 250}`,
      },
      body: JSON.stringify({ email, password }),
    }),
  );
  return { status: response.status, body: (await response.json()) as SignInBody };
}

async function signUp(
  env: AuthEnv,
  email: string,
  password: string,
): Promise<{ status: number; body: SignInBody }> {
  const auth = testAuth(env);
  const response = await auth.handler(
    new Request(`${BASE_URL}/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email, password, name: email.split("@")[0] }),
    }),
  );
  return { status: response.status, body: (await response.json()) as SignInBody };
}

function count(db: DatabaseSync, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get() as { count: number };
  return Number(row.count);
}

describe("Better Auth integration", () => {
  it("seeds atlas/1234 and signs in with the package's email/password endpoint", async () => {
    const db = freshDatabase();
    await seedDevAccount(db);
    const env = testEnv(db);

    const signedIn = await signIn(env, "atlas@local.test", "1234");
    expect(signedIn.status).toBe(200);
    expect(signedIn.body.user?.email).toBe("atlas@local.test");
    expect(typeof signedIn.body.token).toBe("string");

    const verified = await verifyRealtimeAuthToken(signedIn.body.token, env);
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.identity).toMatchObject({
      sub: signedIn.body.user?.id,
      name: "atlas",
      kind: "account",
    });
  });

  it("rejects a wrong password (and does not mint a session)", async () => {
    const db = freshDatabase();
    await seedDevAccount(db);
    const env = testEnv(db);

    const denied = await signIn(env, "atlas@local.test", "not-the-password");
    expect(denied.status).toBe(401);
    expect(denied.body.token).toBeUndefined();
    expect(count(db, "session")).toBe(0);
  });

  it("allows account creation, then signs in once the address is verified", async () => {
    const db = freshDatabase();
    const env = testEnv(db);
    const created = await signUp(env, "new-player@local.test", "long-enough-password");
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    const row = db
      .prepare('SELECT id, emailVerified FROM "user" WHERE email = ?')
      .get("new-player@local.test") as { id: string; emailVerified: number };
    expect(row.id).toBeTruthy();
    expect(Number(row.emailVerified)).toBe(0);
    // The development worker auto-verifies after sign-up; emulate that D1 update.
    db.prepare('UPDATE "user" SET emailVerified = 1 WHERE id = ?').run(row.id);
    const signedIn = await signIn(env, "new-player@local.test", "long-enough-password");
    expect(signedIn.status, JSON.stringify(signedIn.body)).toBe(200);
    expect(typeof signedIn.body.token).toBe("string");
  });

  it("seeds idempotently: one user, one credential account, stable credentials", async () => {
    const db = freshDatabase();
    await seedDevAccount(db);
    await seedDevAccount(db);
    await seedDevAccount(db);
    expect(count(db, "user")).toBe(1);
    expect(count(db, "account")).toBe(1);
    const row = db.prepare(`SELECT id, emailVerified FROM "user"`).get() as {
      id: string;
      emailVerified: number;
    };
    expect(row.id).toBe("seed_atlas");
    expect(Number(row.emailVerified)).toBe(1);
    expect((await signIn(testEnv(db), "atlas@local.test", "1234")).status).toBe(200);
  });

  it("keeps the guest JWT path working next to Better Auth", async () => {
    const db = freshDatabase();
    const env = testEnv(db);
    const guest = await signGuestToken({ name: "Guest One" }, SECRET);
    const verified = await verifyRealtimeAuthToken(guest.token, env);
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.identity).toMatchObject({
      sub: guest.identity.sub,
      name: "Guest One",
      kind: "guest",
    });
  });

  it("accepts the Better Auth identity for coordinator create_room and room join_shell", async () => {
    const db = freshDatabase();
    await seedDevAccount(db);
    const env = testEnv(db);
    const signedIn = await signIn(env, "atlas@local.test", "1234");
    expect(signedIn.status, JSON.stringify(signedIn.body)).toBe(200);
    const token = signedIn.body.token;
    expect(typeof token).toBe("string");
    const verified = await verifyRealtimeAuthToken(token, env);
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;

    const seeds: MatchRoomSeed[] = [];
    const coordinator = new CoordinatorCore({
      clock: { now: () => 1_000, rng: () => 0.5 },
      createMatchRoom: async (seed) => {
        seed.roomCode = "ABC123";
        seeds.push(structuredClone(seed));
        return { roomCode: "ABC123", phase: "lobby" as RoomPhase };
      },
    });
    const created = await coordinator.createRoom(
      {
        action: "create_room",
        operationId: "operation:auth-test",
        playerName: "atlas",
        playMode: "constructed",
        matchFormat: "bo1",
      },
      verified.identity,
    );
    expect(created.status).toBe(200);
    expect(created.body.roomCode).toBe("ABC123");
    expect(seeds[0]?.players[0]).toMatchObject({
      playerId: verified.identity.sub,
      authSubject: verified.identity.sub,
      name: "atlas",
    });

    const sent: Record<string, unknown>[] = [];
    const transport: CoreTransport = {
      send: (_connectionId, message) => sent.push(message),
      close: () => undefined,
    };
    const room = await MatchRoomCore.create(seeds[0]!, {
      transport,
      clock: { now: () => 2_000, rng: () => 0.5 },
      verifyToken: verifierForEnv(env),
    });
    room.addConnection("conn-atlas");
    await room.handleMessage("conn-atlas", {
      type: "join_shell",
      gameInstanceId: "ABC123",
      roomCode: "ABC123",
      authToken: token,
    });
    expect(room.connection("conn-atlas")?.joinedShell, JSON.stringify(sent)).toBe(true);
    expect(sent.some((message) => message.type === "room_shell_sync")).toBe(true);
    expect(sent.some((message) => message.type === "error")).toBe(false);
  });
});
