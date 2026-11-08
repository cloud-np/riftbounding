/**
 * Saved-decks HTTP API coverage (spec 05 §8.2): auth rejection, per-user isolation, optimistic
 * revision conflicts, create/update/list/resolve/rename/delete and status/legality payloads.
 *
 * The D1 store is replaced with an in-memory `SavedDeckStore`; `wrangler dev` verification
 * exercises the real `migrations/0002_saved_decks.sql` SQL.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

import { cards, getCardById } from "@rift/cards";
import type { GuestIdentity } from "../src/auth";
import type { AuthEnv } from "../src/auth-server";
import {
  handleDecksRequest,
  type SavedDeckRow,
  type SavedDeckStore,
} from "../src/decks";

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(
  resolve(HERE, "../../play/e2e/fixtures/atlas-standard.txt"),
  "utf8",
);

const ATLAS: GuestIdentity = {
  sub: "user_atlas",
  name: "Atlas",
  expiresAt: null,
  kind: "account",
};
const MIRA: GuestIdentity = {
  sub: "user_mira",
  name: "Mira",
  expiresAt: null,
  kind: "account",
};
const GUEST: GuestIdentity = {
  sub: "player_guest",
  name: "Guest",
  expiresAt: null,
  kind: "guest",
};

const TOKENS: Record<string, GuestIdentity> = {
  atlas: ATLAS,
  mira: MIRA,
  guest: GUEST,
};

class MemoryStore implements SavedDeckStore {
  rows = new Map<string, SavedDeckRow>();

  async list(userId: string): Promise<SavedDeckRow[]> {
    return [...this.rows.values()]
      .filter((row) => row.userId === userId)
      .sort(
        (a, b) =>
          b.lastUsedAt - a.lastUsedAt ||
          b.updatedAt - a.updatedAt ||
          b.id.localeCompare(a.id),
      );
  }
  async get(id: string): Promise<SavedDeckRow | null> {
    return this.rows.get(id) ?? null;
  }
  async insert(row: SavedDeckRow): Promise<void> {
    this.rows.set(row.id, { ...row });
  }
  async update(
    id: string,
    userId: string,
    expectedRevision: number | null,
    row: SavedDeckRow,
  ): Promise<boolean> {
    const existing = this.rows.get(id);
    if (!existing || existing.userId !== userId) return false;
    if (expectedRevision !== null && existing.revision !== expectedRevision) return false;
    this.rows.set(id, { ...row });
    return true;
  }
  async delete(id: string, userId: string): Promise<boolean> {
    const existing = this.rows.get(id);
    if (!existing || existing.userId !== userId) return false;
    this.rows.delete(id);
    return true;
  }
  async recordUse(id: string, userId: string, at: number): Promise<void> {
    const existing = this.rows.get(id);
    if (existing && existing.userId === userId) existing.lastUsedAt = at;
  }
}

function legalDecklist(): string {
  const main = cards()
    .filter(
      (card) =>
        (card.type === "Unit" || card.type === "Spell" || card.type === "Gear") &&
        card.domains.every((domain) => domain === "Fury" || domain === "Mind") &&
        !card.signatureType &&
        !card.bannedIn,
    )
    .slice(0, 13)
    .map((card) => `3 ${card.name} [${card.id}]`)
    .join("\n");
  return [
    "Legend:",
    "1 Kai'Sa, Daughter of the Void [OGN-247]",
    "Champion:",
    "1 Kai'Sa, Survivor [OGN-039]",
    "MainDeck:",
    main,
    "Battlefields:",
    "1 Altar to Unity [OGN-275]",
    "1 Back-Alley Bar [OGN-277]",
    "1 Fortified Position [OGN-279]",
    "Runes:",
    "6 Fury Rune [OGN-007]",
    "6 Mind Rune [OGN-089]",
  ].join("\n");
}

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

function makeApi(store: SavedDeckStore) {
  let now = 1_700_000_000_000;
  return {
    tick(ms = 1_000) {
      now += ms;
      return now;
    },
    async call(
      token: string | null,
      path: string,
      init: { method?: string; body?: unknown } = {},
    ): Promise<ApiResult> {
      const headers: Record<string, string> = {};
      if (token) headers.authorization = `Bearer ${token}`;
      if (init.body !== undefined) headers["content-type"] = "application/json";
      const request = new Request(`http://localhost:1990/api/decks${path}`, {
        method: init.method ?? "GET",
        headers,
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      });
      const response = await handleDecksRequest(request, {} as AuthEnv, {
        verify: async (value) => TOKENS[value] ?? null,
        store,
        now: () => now,
      });
      if (!response) throw new Error("handler did not match the decks path");
      return { status: response.status, body: (await response.json()) as Record<string, unknown> };
    },
  };
}

describe("saved decks API", () => {
  let store: MemoryStore;
  let api: ReturnType<typeof makeApi>;

  beforeEach(() => {
    store = new MemoryStore();
    api = makeApi(store);
  });

  it("rejects missing, invalid and guest credentials", async () => {
    const missing = await api.call(null, "");
    expect(missing.status).toBe(401);
    expect(missing.body.error).toBe("unauthenticated");

    const invalid = await api.call("not-a-token", "");
    expect(invalid.status).toBe(401);

    const guest = await api.call("guest", "");
    expect(guest.status).toBe(403);
    expect(guest.body.error).toBe("account_required");
  });

  it("creates a deck from raw text, lists summaries, and resolves it for play", async () => {
    const created = await api.call("atlas", "/create", {
      method: "POST",
      body: { name: "Atlas Standard", decklistRaw: legalDecklist() },
    });
    expect(created.status).toBe(200);
    const createdDeck = created.body.deck as Record<string, unknown>;
    expect(createdDeck.status).toBe("ready");
    expect(createdDeck.revision).toBe(1);
    expect(createdDeck.legalityVersion).toBeTruthy();
    expect(createdDeck.id).toMatch(/^deck_/u);

    const list = await api.call("atlas", "");
    expect(list.status).toBe(200);
    const decks = list.body.decks as Array<Record<string, unknown>>;
    expect(decks).toHaveLength(1);
    expect(decks[0]).toMatchObject({
      id: createdDeck.id,
      name: "Atlas Standard",
      status: "ready",
      identity: "Kai'Sa, Daughter of the Void · Kai'Sa, Survivor",
    });
    expect(decks[0]?.lastUsedAt).toEqual(expect.any(Number));
    expect(decks[0]?.updatedAt).toEqual(expect.any(Number));

    const resolved = await api.call("atlas", `/${String(createdDeck.id)}/resolve?fresh=1`);
    expect(resolved.status).toBe(200);
    const result = resolved.body.result as Record<string, unknown>;
    expect(result.kind).toBe("found");
    const playDeck = result.deck as Record<string, unknown>;
    expect(playDeck).toMatchObject({
      id: createdDeck.id,
      name: "Atlas Standard",
      status: "ready",
      revision: 1,
    });
    const content = playDeck.deckContent as Record<string, unknown>;
    expect(content.kind).toBe("parsedDeck");
    const parsed = content.parsedDeck as Record<string, unknown>;
    expect((parsed.sections as Record<string, unknown[]>).legend).toHaveLength(1);
    expect(parsed.errors).toEqual([]);
  });

  it("isolates users: no list, snapshot, resolve, rename or delete across owners", async () => {
    const created = await api.call("atlas", "/create", {
      method: "POST",
      body: { name: "Private Deck", decklistRaw: legalDecklist() },
    });
    const deckId = (created.body.deck as Record<string, unknown>).id as string;

    const list = await api.call("mira", "");
    expect(list.body.decks).toEqual([]);

    const editor = await api.call("mira", `/${deckId}/editor`);
    expect(editor.status).toBe(200);
    expect(editor.body.deck).toBeNull();

    const workspace = await api.call("mira", `/${deckId}/workspace`);
    expect(workspace.status).toBe(200);
    expect(workspace.body.deck).toBeNull();

    const resolve = await api.call("mira", `/${deckId}/resolve?fresh=1`);
    expect(resolve.status).toBe(200);
    expect(resolve.body.result).toEqual({ kind: "missing" });

    const rename = await api.call("mira", `/${deckId}/rename`, {
      method: "POST",
      body: { name: "Stolen" },
    });
    expect(rename.status).toBe(404);

    const remove = await api.call("mira", `/${deckId}`, { method: "DELETE" });
    expect(remove.status).toBe(404);

    const upsert = await api.call("mira", "/upsert", {
      method: "POST",
      body: {
        deckId,
        name: "Stolen",
        deckSections: { legend: [], champion: [], mainDeck: [], battlefields: [], runes: [], sideboard: [] },
        guideHtml: "",
      },
    });
    expect(upsert.status).toBe(404);

    // Atlas still owns and sees the untouched deck.
    const ownList = await api.call("atlas", "");
    expect((ownList.body.decks as unknown[]).length).toBe(1);
  });

  it("enforces optimistic revisions on update and rename", async () => {
    const created = await api.call("atlas", "/create", {
      method: "POST",
      body: { name: "Revision Deck", decklistRaw: legalDecklist() },
    });
    const deckId = (created.body.deck as Record<string, unknown>).id as string;

    const sections = {
      legend: [{ count: 1, name: "Kai'Sa, Daughter of the Void", cardCode: "OGN-247" }],
      champion: [{ count: 1, name: "Kai'Sa, Survivor", cardCode: "OGN-039" }],
      mainDeck: [{ count: 39, name: "Blazing Scorcher", cardCode: "OGN-001" }],
      battlefields: [],
      runes: [],
      sideboard: [],
    };
    const updated = await api.call("atlas", "/upsert", {
      method: "POST",
      body: { deckId, name: "Revision Deck v2", deckSections: sections, guideHtml: "<p>Guide</p>", revision: 1 },
    });
    expect(updated.status).toBe(200);
    expect((updated.body.deck as Record<string, unknown>).revision).toBe(2);

    const stale = await api.call("atlas", "/upsert", {
      method: "POST",
      body: { deckId, name: "Revision Deck v3", deckSections: sections, guideHtml: "", revision: 1 },
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error).toBe("revision_conflict");
    expect(stale.body.currentRevision).toBe(2);

    const rename = await api.call("atlas", `/${deckId}/rename`, {
      method: "POST",
      body: { name: "Renamed", revision: 2 },
    });
    expect(rename.status).toBe(200);
    expect(rename.body.result).toMatchObject({
      previousRevision: 2,
      revision: 3,
      status: "incomplete",
    });

    const staleRename = await api.call("atlas", `/${deckId}/rename`, {
      method: "POST",
      body: { name: "Nope", revision: 2 },
    });
    expect(staleRename.status).toBe(409);

    const editor = await api.call("atlas", `/${deckId}/editor`);
    const snapshot = editor.body.deck as Record<string, unknown>;
    expect(snapshot).toMatchObject({ name: "Renamed", revision: 3, guideHtml: "<p>Guide</p>" });
    expect((snapshot.deckContent as Record<string, unknown>).kind).toBe("parsedDeck");
  });

  it("returns unchanged for a matching known revision and bumps lastUsedAt on fresh resolve", async () => {
    const first = await api.call("atlas", "/create", {
      method: "POST",
      body: { name: "Older", decklistRaw: legalDecklist() },
    });
    const firstDeck = first.body.deck as Record<string, unknown>;
    const firstId = firstDeck.id as string;
    const legalityVersion = firstDeck.legalityVersion as string;

    api.tick(5_000);
    const second = await api.call("atlas", "/create", {
      method: "POST",
      body: { name: "Newer", decklistRaw: fixture },
    });
    const secondId = (second.body.deck as Record<string, unknown>).id as string;

    let list = await api.call("atlas", "");
    let decks = list.body.decks as Array<Record<string, unknown>>;
    expect(decks.map((deck) => deck.id)).toEqual([secondId, firstId]);

    api.tick(5_000);
    const fresh = await api.call("atlas", `/${firstId}/resolve?fresh=1&recordUse=1`);
    expect((fresh.body.result as Record<string, unknown>).kind).toBe("found");

    list = await api.call("atlas", "");
    decks = list.body.decks as Array<Record<string, unknown>>;
    expect(decks.map((deck) => deck.id)).toEqual([firstId, secondId]);

    const unchanged = await api.call(
      "atlas",
      `/${firstId}/resolve?knownRevision=1&knownLegalityVersion=${encodeURIComponent(legalityVersion)}&knownStatus=ready`,
    );
    expect(unchanged.status).toBe(200);
    expect(unchanged.body.result).toMatchObject({
      kind: "unchanged",
      revision: 1,
      legalityVersion,
      status: "ready",
    });
  });

  it("validates names, section shapes and decklist length", async () => {
    const noName = await api.call("atlas", "/create", {
      method: "POST",
      body: { name: "  ", decklistRaw: legalDecklist() },
    });
    expect(noName.status).toBe(400);
    expect(noName.body.error).toBe("invalid_deck_name");

    const tooLong = await api.call("atlas", "/create", {
      method: "POST",
      body: { name: "Huge", decklistRaw: "x".repeat(20_001) },
    });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error).toBe("decklist_too_long");

    const badSections = await api.call("atlas", "/upsert", {
      method: "POST",
      body: { name: "Bad", deckSections: { legend: "nope" }, guideHtml: "" },
    });
    expect(badSections.status).toBe(400);
    expect(badSections.body.error).toBe("invalid_deck_sections");

    const unknownRoute = await api.call("atlas", "/deck_unknown/editor");
    expect(unknownRoute.status).toBe(200);
    expect(unknownRoute.body.deck).toBeNull();
  });

  it("creates via upsert, merges duplicate entries, and deletes", async () => {
    const created = await api.call("atlas", "/upsert", {
      method: "POST",
      body: {
        name: "Upsert Deck",
        guideHtml: "",
        deckSections: {
          legend: [
            { count: 1, name: "Kai'Sa, Daughter of the Void", cardCode: "OGN-247" },
            { count: 1, name: "Kai'Sa, Daughter of the Void", cardCode: "OGN-247" },
          ],
          champion: [{ count: 1, name: "Kai'Sa, Survivor", cardCode: "OGN-039" }],
          mainDeck: [
            { count: 2, name: "Blazing Scorcher", cardCode: "OGN-001" },
            { count: 3, name: "Blazing Scorcher", cardCode: "OGN-001" },
          ],
          battlefields: [],
          runes: [],
          sideboard: [],
        },
      },
    });
    expect(created.status).toBe(200);
    const deck = created.body.deck as Record<string, unknown>;
    expect(deck.status).toBe("incomplete");
    const deckId = deck.id as string;

    const editor = await api.call("atlas", `/${deckId}/editor`);
    const snapshot = editor.body.deck as Record<string, unknown>;
    const content = snapshot.deckContent as Record<string, unknown>;
    const parsed = content.parsedDeck as Record<string, unknown>;
    const sections = parsed.sections as Record<string, Array<Record<string, unknown>>>;
    expect(sections.legend).toHaveLength(1);
    expect(sections.legend?.[0]?.count).toBe(2);
    expect(sections.mainDeck?.[0]?.count).toBe(5);

    const removed = await api.call("atlas", `/${deckId}`, { method: "DELETE" });
    expect(removed.status).toBe(200);
    expect(removed.body.result).toEqual({ id: deckId });
    expect(store.rows.size).toBe(0);
  });

  it("computes the feature card from the champion and keeps the original summary shape", async () => {
    const created = await api.call("atlas", "/create", {
      method: "POST",
      body: { name: "Feature", decklistRaw: legalDecklist() },
    });
    const list = await api.call("atlas", "");
    const summary = (list.body.decks as Array<Record<string, unknown>>)[0]!;
    expect(summary.featureCardId).toBe("OGN-039");
    expect(summary.featureCardImageUrl).toContain("OGN-039");
    expect(summary.publishedDeckId).toBeNull();
    expect(getCardById("OGN-039")?.name).toBe("Kai'Sa, Survivor");
    expect((created.body.deck as Record<string, unknown>).status).toBe("ready");
  });
});
