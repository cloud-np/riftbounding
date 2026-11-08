import { beforeEach, describe, expect, it, vi } from "vitest";

const authClientMock = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
}));

vi.mock("@cloud-np/auth/client", () => ({
  createCloudAuthClient: () => ({
    signIn: { email: authClientMock.signInEmail },
    signUp: { email: authClientMock.signUpEmail },
  }),
}));

import {
  AccountAuthError,
  accountEmailFor,
  getAuthToken,
  loginWithPassword,
  readStoredAccountSession,
  resolveIdentity,
  signOutAccount,
  storeToken,
} from "../auth";

class MemoryStorage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

function guestJwt(payload: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(payload))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return `header.${encoded}.signature`;
}

describe("play auth adapter (@cloud-np/auth client)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    authClientMock.signInEmail.mockReset();
    authClientMock.signUpEmail.mockReset();
    authClientMock.signInEmail.mockResolvedValue({
      data: {
        token: "better-auth-session-token",
        user: { id: "seed_atlas", name: "atlas", email: "atlas@local.test" },
      },
      error: null,
    });
  });

  it("maps the atlas username shortcut to its email and persists the Better Auth session", async () => {
    expect(accountEmailFor("atlas")).toBe("atlas@local.test");
    expect(accountEmailFor("Someone@Example.com")).toBe("someone@example.com");

    const result = await loginWithPassword("atlas", "1234");
    expect(authClientMock.signInEmail).toHaveBeenCalledWith({
      email: "atlas@local.test",
      password: "1234",
      rememberMe: true,
    });
    expect(result.token).toBe("better-auth-session-token");
    expect(result.identity).toMatchObject({
      subject: "seed_atlas",
      name: "atlas",
      kind: "account",
    });
    expect(readStoredAccountSession()?.token).toBe("better-auth-session-token");
    expect(resolveIdentity()).toMatchObject({
      subject: "seed_atlas",
      name: "atlas",
      kind: "account",
    });
    expect(await getAuthToken()).toBe("better-auth-session-token");
  });

  it("surfaces a rejected password and keeps the user signed out", async () => {
    authClientMock.signInEmail.mockResolvedValue({
      data: null,
      error: {
        status: 401,
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
      },
    });
    await expect(loginWithPassword("atlas", "wrong")).rejects.toBeInstanceOf(AccountAuthError);
    expect(readStoredAccountSession()).toBeNull();
    expect(resolveIdentity().kind).toBe("guest");
  });

  it("keeps the guest JWT path when no account session exists", async () => {
    const token = guestJwt({ sub: "player_guest", name: "Guest One", exp: 4_000_000_000 });
    storeToken(token);
    expect(resolveIdentity()).toMatchObject({
      subject: "player_guest",
      name: "Guest One",
      kind: "guest",
    });
    expect(await getAuthToken()).toBe(token);
  });

  it("clears the Better Auth session locally and tells the server to revoke it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await loginWithPassword("atlas", "1234");
    signOutAccount();
    expect(readStoredAccountSession()).toBeNull();
    expect(resolveIdentity().kind).toBe("guest");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/sign-out"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer better-auth-session-token",
        }),
      }),
    );
  });
});
