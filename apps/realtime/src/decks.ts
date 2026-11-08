/**
 * Saved decks HTTP API (spec 05 §8.2).
 *
 * `savedDecks.*` in the original is a Convex module. Our clone keeps the same function names and
 * payload semantics but exposes them over authenticated HTTP from the realtime worker, with rows
 * in the same D1 database as Better Auth (`AUTH_DB`). Only Better Auth account sessions own a
 * server library; guests keep the browser draft (spec 05 §8.1).
 *
 * Routes (all require `Authorization: Bearer <Better Auth session token>`):
 *
 *   GET    /api/decks                       listSavedDeckSummaries
 *   POST   /api/decks/upsert                upsertSavedDeck (create when deckId omitted)
 *   POST   /api/decks/create                createSavedDeck
 *   GET    /api/decks/:id/editor            getSavedDeckEditorSnapshot
 *   GET    /api/decks/:id/workspace         getSavedDeckWorkspaceState
 *   GET    /api/decks/:id/resolve[?fresh=1] resolveSavedDeckForPlay[Fresh]
 *   POST   /api/decks/:id/rename            renameSavedDeck
 *   DELETE /api/decks/:id                   deleteSavedDeck
 */

import {
  buildCardImageUrl,
  exportDeckText,
  parseDeckText,
  validateDeck,
} from "@rift/cards";
import type { DeckSections, ParsedDeck } from "@rift/cards";

import { verifyRealtimeAuthToken, type AuthEnv } from "./auth-server";
import type { GuestIdentity } from "./auth";

/**
 * Version of the deck legality rules. Bump this whenever `@rift/cards` bans / constructed rules
 * change; clients that cached a deck compare it and re-resolve when it differs.
 */
export const SAVED_DECK_LEGALITY_VERSION = "standard-2026-10-24";

export type SavedDeckStatus = "ready" | "incomplete";

export interface SavedDeckRow {
  id: string;
  userId: string;
  name: string;
  decklistRaw: string;
  deckSections: DeckSections;
  deckCode: string | null;
  guideHtml: string;
  revision: number;
  legalityVersion: string;
  status: SavedDeckStatus;
  identity: string;
  featureCardId: string | null;
  featureCardImageUrl: string | null;
  publishedDeckId: string | null;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number;
}

export interface SavedDeckSummary {
  id: string;
  name: string;
  status: SavedDeckStatus;
  identity: string;
  featureCardId?: string;
  featureCardImageUrl?: string;
  lastUsedAt: number;
  updatedAt: number;
  publishedDeckId?: string | null;
}

export type DeckContent =
  | { kind: "parsedDeck"; parsedDeck: ParsedDeck }
  | { kind: "deckCode"; deckCode: string };

export interface SavedDeckPlaySnapshot {
  id: string;
  name: string;
  status: SavedDeckStatus;
  legalityVersion: string;
  revision: number;
  deckContent: DeckContent;
  publishedDeckId?: string | null;
}

export type ResolveSavedDeckResult =
  | { kind: "found"; deck: SavedDeckPlaySnapshot }
  | { kind: "unchanged"; legalityVersion: string; revision: number; status: string }
  | { kind: "missing" }
  | { kind: "unavailable" };

export interface SavedDeckEditorSnapshot {
  id: string;
  name: string;
  status: SavedDeckStatus;
  guideHtml: string;
  legalityVersion: string;
  revision: number;
  updatedAt: number;
  deckContent: DeckContent;
  publishedDeckId?: string | null;
}

export interface SavedDeckWorkspaceState {
  id: string;
  name: string;
  status: SavedDeckStatus;
  guideHtml: string;
  legalityVersion: string;
  revision: number;
  updatedAt: number;
  publishedDeckId?: string | null;
}

export interface SavedDeckStore {
  list(userId: string): Promise<SavedDeckRow[]>;
  get(id: string): Promise<SavedDeckRow | null>;
  insert(row: SavedDeckRow): Promise<void>;
  /** Returns false when the `(id,userId,revision)` guard no longer matches. */
  update(
    id: string,
    userId: string,
    expectedRevision: number | null,
    row: SavedDeckRow,
  ): Promise<boolean>;
  delete(id: string, userId: string): Promise<boolean>;
  recordUse(id: string, userId: string, at: number): Promise<void>;
}

/* ------------------------------------------------------------------ D1 store */

interface SavedDeckDbRow {
  id: string;
  user_id: string;
  name: string;
  decklist_raw: string;
  deck_sections_json: string;
  deck_code: string | null;
  guide_html: string;
  revision: number;
  legality_version: string;
  status: string;
  identity: string;
  feature_card_id: string | null;
  feature_card_image_url: string | null;
  published_deck_id: string | null;
  created_at: number;
  updated_at: number;
  last_used_at: number;
}

function parseSections(json: string): DeckSections {
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return emptySections();
    const result = emptySections();
    for (const key of SECTION_KEYS) {
      const value = (parsed as Record<string, unknown>)[key];
      if (!Array.isArray(value)) continue;
      result[key] = value
        .filter(
          (entry): entry is { count: number; name: string; cardCode?: string } =>
            typeof entry === "object" &&
            entry !== null &&
            typeof (entry as { count?: unknown }).count === "number" &&
            typeof (entry as { name?: unknown }).name === "string",
        )
        .map((entry) => ({
          count: entry.count,
          name: entry.name,
          ...(typeof entry.cardCode === "string" ? { cardCode: entry.cardCode } : {}),
        }));
    }
    return result;
  } catch {
    return emptySections();
  }
}

function rowFromDb(row: SavedDeckDbRow): SavedDeckRow {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    decklistRaw: row.decklist_raw,
    deckSections: parseSections(row.deck_sections_json),
    deckCode: row.deck_code ?? null,
    guideHtml: row.guide_html,
    revision: row.revision,
    legalityVersion: row.legality_version,
    status: row.status === "ready" ? "ready" : "incomplete",
    identity: row.identity,
    featureCardId: row.feature_card_id ?? null,
    featureCardImageUrl: row.feature_card_image_url ?? null,
    publishedDeckId: row.published_deck_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
  };
}

/** D1-backed store. The migration lives in `migrations/0002_saved_decks.sql`. */
export function d1SavedDeckStore(db: D1Database): SavedDeckStore {
  return {
    async list(userId) {
      const result = await db
        .prepare(
          "SELECT * FROM saved_decks WHERE user_id = ? ORDER BY last_used_at DESC, updated_at DESC, id DESC",
        )
        .bind(userId)
        .all<SavedDeckDbRow>();
      return (result.results ?? []).map(rowFromDb);
    },
    async get(id) {
      const row = await db
        .prepare("SELECT * FROM saved_decks WHERE id = ?")
        .bind(id)
        .first<SavedDeckDbRow>();
      return row ? rowFromDb(row) : null;
    },
    async insert(row) {
      await db
        .prepare(
          `INSERT INTO saved_decks
             (id, user_id, name, decklist_raw, deck_sections_json, deck_code, guide_html,
              revision, legality_version, status, identity, feature_card_id,
              feature_card_image_url, published_deck_id, created_at, updated_at, last_used_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          row.id,
          row.userId,
          row.name,
          row.decklistRaw,
          JSON.stringify(row.deckSections),
          row.deckCode,
          row.guideHtml,
          row.revision,
          row.legalityVersion,
          row.status,
          row.identity,
          row.featureCardId,
          row.featureCardImageUrl,
          row.publishedDeckId,
          row.createdAt,
          row.updatedAt,
          row.lastUsedAt,
        )
        .run();
    },
    async update(id, userId, expectedRevision, row) {
      const result = await db
        .prepare(
          `UPDATE saved_decks
              SET name = ?, decklist_raw = ?, deck_sections_json = ?, deck_code = ?, guide_html = ?,
                  revision = ?, legality_version = ?, status = ?, identity = ?, feature_card_id = ?,
                  feature_card_image_url = ?, published_deck_id = ?, updated_at = ?, last_used_at = ?
            WHERE id = ? AND user_id = ?${expectedRevision === null ? "" : " AND revision = ?"}`,
        )
        .bind(
          row.name,
          row.decklistRaw,
          JSON.stringify(row.deckSections),
          row.deckCode,
          row.guideHtml,
          row.revision,
          row.legalityVersion,
          row.status,
          row.identity,
          row.featureCardId,
          row.featureCardImageUrl,
          row.publishedDeckId,
          row.updatedAt,
          row.lastUsedAt,
          id,
          userId,
          ...(expectedRevision === null ? [] : [expectedRevision]),
        )
        .run();
      return (result.meta?.changes ?? 0) > 0;
    },
    async delete(id, userId) {
      const result = await db
        .prepare("DELETE FROM saved_decks WHERE id = ? AND user_id = ?")
        .bind(id, userId)
        .run();
      return (result.meta?.changes ?? 0) > 0;
    },
    async recordUse(id, userId, at) {
      await db
        .prepare("UPDATE saved_decks SET last_used_at = ? WHERE id = ? AND user_id = ?")
        .bind(at, id, userId)
        .run();
    },
  };
}

/* ------------------------------------------------------------------ payloads */

export const SECTION_KEYS = [
  "legend",
  "champion",
  "mainDeck",
  "battlefields",
  "runes",
  "sideboard",
] as const;

export const MAX_DECKLIST_RAW_LENGTH = 20_000;
export const MAX_DECK_NAME_LENGTH = 120;
export const MAX_GUIDE_HTML_LENGTH = 100_000;

export function emptySections(): DeckSections {
  return {
    legend: [],
    champion: [],
    mainDeck: [],
    battlefields: [],
    runes: [],
    sideboard: [],
  };
}

/** Merge duplicates and sort like the builder's normalization (spec 05 §5.1). */
export function normalizeDeckSections(value: unknown): DeckSections | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const sections = emptySections();
  for (const key of SECTION_KEYS) {
    const rawEntries = record[key];
    if (rawEntries === undefined) continue;
    if (!Array.isArray(rawEntries)) return null;
    const merged = new Map<string, { count: number; name: string; cardCode?: string }>();
    for (const rawEntry of rawEntries) {
      if (typeof rawEntry !== "object" || rawEntry === null) return null;
      const entry = rawEntry as Record<string, unknown>;
      const name = typeof entry.name === "string" ? entry.name.trim().replace(/\s+/gu, " ") : "";
      const count = typeof entry.count === "number" ? Math.trunc(entry.count) : 0;
      if (!name || !Number.isFinite(count) || count <= 0) continue;
      const cardCode =
        typeof entry.cardCode === "string" && entry.cardCode.trim()
          ? entry.cardCode.trim().toUpperCase()
          : undefined;
      const dedupeKey = cardCode ? `code:${cardCode}` : `name:${name.toLowerCase()}`;
      const existing = merged.get(dedupeKey);
      if (existing) {
        existing.count = Math.min(999, existing.count + Math.min(count, 999));
        if (!existing.cardCode && cardCode) existing.cardCode = cardCode;
      } else {
        merged.set(dedupeKey, {
          count: Math.min(999, count),
          name,
          ...(cardCode ? { cardCode } : {}),
        });
      }
    }
    sections[key] = [...merged.values()];
    if (key !== "legend") {
      sections[key].sort(
        (a, b) =>
          a.name.localeCompare(b.name, "en", { sensitivity: "base" }) ||
          (a.cardCode ?? "").localeCompare(b.cardCode ?? ""),
      );
    }
  }
  return sections;
}

export function analyzeDeck(raw: string): { parsed: ParsedDeck; status: SavedDeckStatus } {
  const parsed = parseDeckText(raw, { validateCatalog: true, deckRulesMode: "standard" });
  const validation = validateDeck(parsed, {
    format: "standard-constructed",
    deckRulesMode: "standard",
  });
  const status: SavedDeckStatus =
    parsed.errors.length === 0 && validation.valid ? "ready" : "incomplete";
  return { parsed, status };
}

function deckIdentity(sections: DeckSections): {
  identity: string;
  featureCardId: string | null;
  featureCardImageUrl: string | null;
} {
  const legend = sections.legend[0];
  const champion = sections.champion[0];
  const identity = [legend?.name, champion?.name].filter(Boolean).join(" · ");
  const feature = champion ?? legend;
  const featureCardId = feature?.cardCode ?? null;
  return {
    identity,
    featureCardId,
    featureCardImageUrl: featureCardId
      ? buildCardImageUrl(featureCardId, "small-v2") || null
      : null,
  };
}

function summaryFor(row: SavedDeckRow): SavedDeckSummary {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    identity: row.identity,
    ...(row.featureCardId ? { featureCardId: row.featureCardId } : {}),
    ...(row.featureCardImageUrl ? { featureCardImageUrl: row.featureCardImageUrl } : {}),
    lastUsedAt: row.lastUsedAt,
    updatedAt: row.updatedAt,
    publishedDeckId: row.publishedDeckId,
  };
}

function playSnapshot(row: SavedDeckRow): SavedDeckPlaySnapshot {
  const { parsed } = analyzeDeck(row.decklistRaw);
  const deckContent: DeckContent = row.deckCode
    ? { kind: "deckCode", deckCode: row.deckCode }
    : { kind: "parsedDeck", parsedDeck: parsed };
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    legalityVersion: row.legalityVersion,
    revision: row.revision,
    deckContent,
    publishedDeckId: row.publishedDeckId,
  };
}

/* ------------------------------------------------------------------ routing */

export interface DeckRequestDeps {
  /** Inject a fake verifier in tests; defaults to the realtime auth verifier. */
  verify?: (token: string) => Promise<GuestIdentity | null>;
  /** Inject an in-memory store in tests; defaults to D1 (`env.AUTH_DB`). */
  store?: SavedDeckStore;
  now?: () => number;
}

interface AuthContext {
  identity: GuestIdentity;
  store: SavedDeckStore;
  now: () => number;
}

const DECK_PATH = /^\/api\/decks(?:\/([^/]+)(?:\/(editor|workspace|resolve|rename))?)?\/?$/u;

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin")?.trim() ?? "";
  const reflected =
    origin.length > 0 &&
    (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/iu.test(origin) ||
      /^https?:\/\/([a-z0-9-]+\.)*(riftatlas\.com|riftatlas-workers\.com|pages\.dev)$/iu.test(
        origin,
      ));
  return {
    "access-control-allow-origin": reflected ? origin : "*",
    "access-control-allow-headers": "content-type,authorization,x-captcha-response,accept-language",
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-expose-headers": "set-auth-token",
    ...(reflected ? { vary: "origin", "access-control-allow-credentials": "true" } : {}),
  };
}

function json(body: Record<string, unknown>, status: number, request: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders(request) },
  });
}

function error(
  request: Request,
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): Response {
  return json({ ok: false, error: code, message, ...extra }, status, request);
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (!text.trim()) return {};
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization")?.trim() ?? "";
  if (/^bearer\s+/iu.test(header)) return header.replace(/^bearer\s+/iu, "").trim();
  return "";
}

/**
 * Authenticate a saved-deck request. Account sessions only: the guest JWT is valid for rooms but
 * guests do not have a server deck library.
 */
async function authenticate(
  request: Request,
  env: AuthEnv,
  deps: DeckRequestDeps,
): Promise<AuthContext | Response> {
  const token = bearerToken(request);
  if (!token) return error(request, 401, "unauthenticated", "Sign in to use your deck library.");
  if (deps.verify) {
    const identity = await deps.verify(token);
    if (!identity) {
      return error(request, 401, "unauthenticated", "Sign in to use your deck library.");
    }
    if (identity.kind !== "account") {
      return error(
        request,
        403,
        "account_required",
        "Sign in with an account to save decks. Guests keep their browser draft.",
      );
    }
    const store = deps.store;
    if (!store) throw new Error("No saved deck store configured.");
    return { identity, store, now: deps.now ?? Date.now };
  }

  const result = await verifyRealtimeAuthToken(token, env);
  if (!result.ok || result.identity.kind !== "account") {
    return error(
      request,
      result.ok ? 403 : 401,
      result.ok ? "account_required" : "unauthenticated",
      result.ok
        ? "Sign in with an account to save decks. Guests keep their browser draft."
        : "Sign in to use your deck library.",
    );
  }
  if (!env.AUTH_DB) {
    return error(request, 503, "decks_unavailable", "The deck library is not configured.");
  }
  return {
    identity: result.identity,
    store: deps.store ?? d1SavedDeckStore(env.AUTH_DB),
    now: deps.now ?? Date.now,
  };
}

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/gu, " ");
  if (!name) return null;
  return name.slice(0, MAX_DECK_NAME_LENGTH);
}

function readGuide(value: unknown): string {
  return typeof value === "string" ? value.slice(0, MAX_GUIDE_HTML_LENGTH) : "";
}

function currentRevision(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function assertRawLength(raw: string): string | null {
  if (raw.length > MAX_DECKLIST_RAW_LENGTH) {
    return `Deck list cannot exceed ${MAX_DECKLIST_RAW_LENGTH.toLocaleString("en-US")} characters. Found ${raw.length.toLocaleString("en-US")}.`;
  }
  return null;
}

function rowFor(input: {
  id: string;
  userId: string;
  name: string;
  sections: DeckSections;
  guideHtml: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number;
  publishedDeckId?: string | null;
  deckCode?: string | null;
}): SavedDeckRow {
  const raw = exportDeckText(input.sections, { includeCardCodes: true });
  const { status } = analyzeDeck(raw);
  return {
    id: input.id,
    userId: input.userId,
    name: input.name,
    decklistRaw: raw,
    deckSections: input.sections,
    deckCode: input.deckCode ?? null,
    guideHtml: input.guideHtml,
    revision: input.revision,
    legalityVersion: SAVED_DECK_LEGALITY_VERSION,
    status,
    ...deckIdentity(input.sections),
    publishedDeckId: input.publishedDeckId ?? null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    lastUsedAt: input.lastUsedAt,
  };
}

function newDeckId(): string {
  return `deck_${crypto.randomUUID()}`;
}

/* ------------------------------------------------------------------ handlers */

async function listDecks(request: Request, ctx: AuthContext): Promise<Response> {
  const rows = await ctx.store.list(ctx.identity.sub);
  return json({ ok: true, decks: rows.map(summaryFor) }, 200, request);
}

async function upsertDeck(request: Request, ctx: AuthContext, body: Record<string, unknown>) {
  if (!body) return error(request, 400, "invalid_json", "The request body must be a JSON object.");
  const name = cleanName(body.name);
  if (!name) return error(request, 400, "invalid_deck_name", "Deck name is required before saving.");
  const sections = normalizeDeckSections(body.deckSections);
  if (!sections) {
    return error(request, 400, "invalid_deck_sections", "The deck sections are malformed.");
  }
  const guideHtml = readGuide(body.guideHtml);
  const deckId = typeof body.deckId === "string" && body.deckId.trim() ? body.deckId.trim() : null;
  const now = ctx.now();

  if (!deckId) {
    const row = rowFor({
      id: newDeckId(),
      userId: ctx.identity.sub,
      name,
      sections,
      guideHtml,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: now,
    });
    await ctx.store.insert(row);
    return json(
      {
        ok: true,
        deck: {
          id: row.id,
          name: row.name,
          guideHtml: row.guideHtml,
          status: row.status,
          legalityVersion: row.legalityVersion,
          revision: row.revision,
          updatedAt: row.updatedAt,
        },
      },
      200,
      request,
    );
  }

  const existing = await ctx.store.get(deckId);
  if (!existing || existing.userId !== ctx.identity.sub) {
    return error(request, 404, "deck_not_found", "This saved deck does not exist.");
  }
  const expected = currentRevision(body.revision);
  if (expected !== null && expected !== existing.revision) {
    return error(
      request,
      409,
      "revision_conflict",
      "This deck changed in another tab. Reload it and try again.",
      { currentRevision: existing.revision },
    );
  }
  const row = rowFor({
    id: existing.id,
    userId: existing.userId,
    name,
    sections,
    guideHtml,
    revision: existing.revision + 1,
    createdAt: existing.createdAt,
    updatedAt: now,
    lastUsedAt: existing.lastUsedAt,
    publishedDeckId: existing.publishedDeckId,
    deckCode: existing.deckCode,
  });
  const updated = await ctx.store.update(existing.id, existing.userId, expected, row);
  if (!updated) {
    const latest = await ctx.store.get(existing.id);
    return error(
      request,
      409,
      "revision_conflict",
      "This deck changed in another tab. Reload it and try again.",
      { currentRevision: latest?.revision ?? existing.revision },
    );
  }
  return json(
    {
      ok: true,
      deck: {
        id: row.id,
        name: row.name,
        guideHtml: row.guideHtml,
        status: row.status,
        legalityVersion: row.legalityVersion,
        revision: row.revision,
        updatedAt: row.updatedAt,
      },
    },
    200,
    request,
  );
}

async function createDeck(request: Request, ctx: AuthContext, body: Record<string, unknown>) {
  if (!body) return error(request, 400, "invalid_json", "The request body must be a JSON object.");
  const name = cleanName(body.name);
  if (!name) return error(request, 400, "invalid_deck_name", "Deck name is required before saving.");
  if (typeof body.decklistRaw !== "string") {
    return error(request, 400, "invalid_decklist", "A deck list is required.");
  }
  const raw = body.decklistRaw.replace(/\r\n/gu, "\n");
  const lengthError = assertRawLength(raw);
  if (lengthError) return error(request, 400, "decklist_too_long", lengthError);
  const parsed = parseDeckText(raw, { validateCatalog: true, deckRulesMode: "standard" });
  const { status } = analyzeDeck(raw);
  const now = ctx.now();
  const row: SavedDeckRow = {
    id: newDeckId(),
    userId: ctx.identity.sub,
    name,
    decklistRaw: raw,
    deckSections: parsed.sections,
    deckCode: null,
    guideHtml: "",
    revision: 1,
    legalityVersion: SAVED_DECK_LEGALITY_VERSION,
    status,
    ...deckIdentity(parsed.sections),
    publishedDeckId: null,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
  };
  await ctx.store.insert(row);
  return json(
    {
      ok: true,
      deck: {
        id: row.id,
        legalityVersion: row.legalityVersion,
        revision: row.revision,
        status: row.status,
      },
    },
    200,
    request,
  );
}

async function editorSnapshot(request: Request, ctx: AuthContext, deckId: string) {
  const row = await ctx.store.get(deckId);
  if (!row || row.userId !== ctx.identity.sub) {
    return json({ ok: true, deck: null }, 200, request);
  }
  const { parsed } = analyzeDeck(row.decklistRaw);
  const snapshot: SavedDeckEditorSnapshot = {
    id: row.id,
    name: row.name,
    status: row.status,
    guideHtml: row.guideHtml,
    legalityVersion: row.legalityVersion,
    revision: row.revision,
    updatedAt: row.updatedAt,
    deckContent: { kind: "parsedDeck", parsedDeck: parsed },
    publishedDeckId: row.publishedDeckId,
  };
  return json({ ok: true, deck: snapshot }, 200, request);
}

async function workspaceState(request: Request, ctx: AuthContext, deckId: string) {
  const row = await ctx.store.get(deckId);
  if (!row || row.userId !== ctx.identity.sub) {
    return json({ ok: true, deck: null }, 200, request);
  }
  const snapshot: SavedDeckWorkspaceState = {
    id: row.id,
    name: row.name,
    status: row.status,
    guideHtml: row.guideHtml,
    legalityVersion: row.legalityVersion,
    revision: row.revision,
    updatedAt: row.updatedAt,
    publishedDeckId: row.publishedDeckId,
  };
  return json({ ok: true, deck: snapshot }, 200, request);
}

async function resolveDeck(request: Request, ctx: AuthContext, deckId: string) {
  const url = new URL(request.url);
  const fresh = url.searchParams.get("fresh") === "1";
  const row = await ctx.store.get(deckId);
  if (!row || row.userId !== ctx.identity.sub) {
    return json({ ok: true, result: { kind: "missing" } satisfies ResolveSavedDeckResult }, 200, request);
  }

  const knownLegalityVersion = url.searchParams.get("knownLegalityVersion");
  const knownStatus = url.searchParams.get("knownStatus");
  const knownRevisionRaw = url.searchParams.get("knownRevision");
  const knownRevision =
    knownRevisionRaw !== null && /^\d+$/u.test(knownRevisionRaw)
      ? Number(knownRevisionRaw)
      : null;
  if (
    !fresh &&
    knownRevision !== null &&
    knownRevision === row.revision &&
    knownLegalityVersion === row.legalityVersion &&
    knownStatus === row.status
  ) {
    return json(
      {
        ok: true,
        result: {
          kind: "unchanged",
          legalityVersion: row.legalityVersion,
          revision: row.revision,
          status: row.status,
        } satisfies ResolveSavedDeckResult,
      },
      200,
      request,
    );
  }

  const recordUse = fresh && url.searchParams.get("recordUse") !== "0";
  const now = ctx.now();
  if (recordUse) {
    await ctx.store.recordUse(row.id, row.userId, now);
    row.lastUsedAt = now;
  }
  return json(
    { ok: true, result: { kind: "found", deck: playSnapshot(row) } satisfies ResolveSavedDeckResult },
    200,
    request,
  );
}

async function renameDeck(
  request: Request,
  ctx: AuthContext,
  deckId: string,
  body: Record<string, unknown>,
) {
  if (!body) return error(request, 400, "invalid_json", "The request body must be a JSON object.");
  const name = cleanName(body.name);
  if (!name) return error(request, 400, "invalid_deck_name", "Deck name is required.");
  const row = await ctx.store.get(deckId);
  if (!row || row.userId !== ctx.identity.sub) {
    return error(request, 404, "deck_not_found", "This saved deck does not exist.");
  }
  const expected = currentRevision(body.revision);
  if (expected !== null && expected !== row.revision) {
    return error(
      request,
      409,
      "revision_conflict",
      "This deck changed in another tab. Reload it and try again.",
      { currentRevision: row.revision },
    );
  }
  const previousRevision = row.revision;
  const next: SavedDeckRow = {
    ...row,
    name,
    revision: row.revision + 1,
    updatedAt: ctx.now(),
    legalityVersion: SAVED_DECK_LEGALITY_VERSION,
  };
  const updated = await ctx.store.update(row.id, row.userId, expected, next);
  if (!updated) {
    const latest = await ctx.store.get(row.id);
    return error(
      request,
      409,
      "revision_conflict",
      "This deck changed in another tab. Reload it and try again.",
      { currentRevision: latest?.revision ?? row.revision },
    );
  }
  return json(
    {
      ok: true,
      result: {
        previousRevision,
        legalityVersion: next.legalityVersion,
        revision: next.revision,
        status: next.status,
      },
    },
    200,
    request,
  );
}

async function deleteDeck(request: Request, ctx: AuthContext, deckId: string) {
  const row = await ctx.store.get(deckId);
  if (!row || row.userId !== ctx.identity.sub) {
    return error(request, 404, "deck_not_found", "This saved deck does not exist.");
  }
  await ctx.store.delete(deckId, ctx.identity.sub);
  return json({ ok: true, result: { id: deckId } }, 200, request);
}

/**
 * Top-level handler. Returns `null` when the path is not a saved-decks route so the worker can
 * continue routing (`/api/auth`, parties, …).
 */
export async function handleDecksRequest(
  request: Request,
  env: AuthEnv,
  deps: DeckRequestDeps = {},
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/decks" && !url.pathname.startsWith("/api/decks/")) return null;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  const match = DECK_PATH.exec(url.pathname);
  if (!match) return error(request, 404, "not_found", "This deck route does not exist.");
  const rawDeckId = match[1];
  const action = match[2];
  let deckId: string | null = null;
  if (rawDeckId) {
    try {
      deckId = decodeURIComponent(rawDeckId);
    } catch {
      return error(request, 400, "invalid_deck_id", "The deck id is malformed.");
    }
  }

  const auth = await authenticate(request, env, deps);
  if (auth instanceof Response) return auth;
  try {
    if (!deckId && !action && request.method === "GET") return await listDecks(request, auth);
    if (!deckId && !action && request.method === "POST") {
      const body = await readJson(request);
      if (!body) return error(request, 400, "invalid_json", "The request body must be valid JSON.");
      return error(request, 404, "not_found", "Use /api/decks/upsert or /api/decks/create.");
    }
    if (deckId === null) {
      return error(request, 404, "not_found", "This deck route does not exist.");
    }
    if (request.method === "POST" && !action && deckId === "upsert") {
      const body = await readJson(request);
      if (!body) return error(request, 400, "invalid_json", "The request body must be valid JSON.");
      return await upsertDeck(request, auth, body);
    }
    if (request.method === "POST" && !action && deckId === "create") {
      const body = await readJson(request);
      if (!body) return error(request, 400, "invalid_json", "The request body must be valid JSON.");
      return await createDeck(request, auth, body);
    }
    if (request.method === "GET" && action === "editor") {
      return await editorSnapshot(request, auth, deckId);
    }
    if (request.method === "GET" && action === "workspace") {
      return await workspaceState(request, auth, deckId);
    }
    if (request.method === "GET" && action === "resolve") {
      return await resolveDeck(request, auth, deckId);
    }
    if (request.method === "POST" && action === "rename") {
      const body = await readJson(request);
      if (!body) return error(request, 400, "invalid_json", "The request body must be valid JSON.");
      return await renameDeck(request, auth, deckId, body);
    }
    if (request.method === "DELETE" && !action) {
      return await deleteDeck(request, auth, deckId);
    }
    return error(request, 405, "method_not_allowed", "This deck method is not supported.");
  } catch (cause) {
    console.error("[decks] request failed", cause);
    return error(request, 500, "decks_unavailable", "The deck library is unavailable.");
  }
}
