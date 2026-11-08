/**
 * Saved decks client runtime.
 *
 * The original builder/library stores decks in Convex (`savedDecks.*`, spec 05 §8.2). Our clone
 * keeps the same function names and payload shapes but talks to the realtime worker's
 * authenticated HTTP API (`apps/realtime/src/decks.ts`), backed by D1 (`AUTH_DB`).
 *
 * Stable contract: names and shapes follow the original so the builder (B27) and the lobby can
 * code against this module. Only signed-in Better Auth accounts have a server library; guests
 * keep their localStorage draft (spec 05 §8.1).
 */

import type { DeckSectionKey, ParsedDeck, ParsedDeckEntry } from "@rift/cards";

import { authBase } from "./config";
import { readStoredAccountSession } from "./auth";

export type SavedDeckStatus = "ready" | "incomplete";

/** `savedDecks.listSavedDeckSummaries` row (lobby / library). */
export interface SavedDeckSummary {
  id: string;
  name: string;
  status: SavedDeckStatus;
  /** e.g. `"Riven, The Exile · Riven, Deserter"`. */
  identity: string;
  featureCardId?: string;
  featureCardImageUrl?: string;
  /** ms epoch. */
  lastUsedAt: number;
  /** ms epoch. */
  updatedAt: number;
  publishedDeckId?: string | null;
}

/** The original's `DeckContent`: a parsed deck or a shareable deck code. */
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

/** `savedDecks.resolveSavedDeckForPlay` / `resolveSavedDeckForPlayFresh`. */
export type ResolveSavedDeckResult =
  | { kind: "found"; deck: SavedDeckPlaySnapshot }
  | { kind: "unchanged"; legalityVersion: string; revision: number; status: string }
  | { kind: "missing" }
  | { kind: "unavailable" };

export interface ResolveSavedDeckArgs {
  deckId: string;
  knownLegalityVersion?: string;
  knownRevision?: number;
  knownStatus?: string;
}

export interface ResolveSavedDeckFreshArgs extends ResolveSavedDeckArgs {
  recordUse?: boolean;
}

/** `savedDecks.getSavedDeckEditorSnapshot`. */
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

/** `savedDecks.getSavedDeckWorkspaceState` (same as editor snapshot without `deckContent`). */
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

export interface UpsertSavedDeckArgs {
  /** Omit to create a new deck. */
  deckId?: string;
  name: string;
  deckSections: Record<DeckSectionKey, ParsedDeckEntry[]>;
  guideHtml: string;
  /** Optimistic concurrency. When supplied and stale the API answers `revision_conflict`. */
  revision?: number;
}

export interface UpsertSavedDeckResult {
  id: string;
  name: string;
  guideHtml: string;
  status: SavedDeckStatus;
  legalityVersion: string;
  revision: number;
}

/** `savedDecks.createSavedDeck` (lobby "Save Deck" from a pasted decklist). */
export interface CreateSavedDeckArgs {
  name: string;
  decklistRaw: string;
}

export interface CreateSavedDeckResult {
  id: string;
  legalityVersion: string;
  revision: number;
  status: SavedDeckStatus;
}

export interface RenameSavedDeckArgs {
  deckId: string;
  name: string;
  revision?: number;
}

export interface RenameSavedDeckResult {
  previousRevision: number;
  legalityVersion: string;
  revision: number;
  status: SavedDeckStatus;
}

export interface DeleteSavedDeckResult {
  id: string;
}

/** API error with the worker's stable code (`revision_conflict`, `unauthenticated`, …). */
export class SavedDeckApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Present on `revision_conflict`. */
  readonly currentRevision?: number;

  constructor(status: number, code: string, message: string, currentRevision?: number) {
    super(message);
    this.name = "SavedDeckApiError";
    this.status = status;
    this.code = code;
    if (currentRevision !== undefined) this.currentRevision = currentRevision;
  }
}

interface ApiEnvelope {
  ok?: boolean;
  error?: string;
  message?: string;
  currentRevision?: number;
}

function accountToken(): string {
  const session = readStoredAccountSession();
  if (!session?.token) {
    throw new SavedDeckApiError(401, "unauthenticated", "Sign in to save and load decks.");
  }
  return session.token;
}

async function request<T>(
  path: string,
  init: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  let token: string;
  try {
    token = accountToken();
  } catch (error) {
    throw error;
  }

  let response: Response;
  try {
    response = await fetch(`${authBase()}/api/decks${path}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      cache: "no-store",
      credentials: "omit",
    });
  } catch (error) {
    throw new SavedDeckApiError(
      0,
      "network_error",
      error instanceof Error && error.message
        ? error.message
        : "The deck library is reconnecting. Try again in a moment.",
    );
  }

  let body: (ApiEnvelope & Record<string, unknown>) | null = null;
  try {
    body = (await response.json()) as ApiEnvelope & Record<string, unknown>;
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new SavedDeckApiError(
      response.status,
      typeof body?.error === "string" ? body.error : "request_failed",
      typeof body?.message === "string"
        ? body.message
        : "The deck library is unavailable. Try again in a moment.",
      typeof body?.currentRevision === "number" ? body.currentRevision : undefined,
    );
  }
  return body as T;
}

function deckIdPath(deckId: string): string {
  return `/${encodeURIComponent(deckId)}`;
}

/* ------------------------------------------------------------------ queries */

/** `savedDecks.listSavedDeckSummaries({})` — newest use first, then newest update. */
export async function listSavedDeckSummaries(): Promise<SavedDeckSummary[]> {
  const body = await request<{ decks?: SavedDeckSummary[] }>("");
  return Array.isArray(body.decks) ? body.decks : [];
}

/** `savedDecks.getSavedDeckEditorSnapshot({deckId})`; `null` mirrors the original's missing row. */
export async function getSavedDeckEditorSnapshot(
  deckId: string,
): Promise<SavedDeckEditorSnapshot | null> {
  const body = await request<{ deck?: SavedDeckEditorSnapshot | null }>(
    `${deckIdPath(deckId)}/editor`,
  );
  return body.deck ?? null;
}

/** `savedDecks.getSavedDeckWorkspaceState({deckId})`. */
export async function getSavedDeckWorkspaceState(
  deckId: string,
): Promise<SavedDeckWorkspaceState | null> {
  const body = await request<{ deck?: SavedDeckWorkspaceState | null }>(
    `${deckIdPath(deckId)}/workspace`,
  );
  return body.deck ?? null;
}

export async function resolveSavedDeckForPlay(
  args: ResolveSavedDeckArgs,
): Promise<ResolveSavedDeckResult> {
  return resolveSavedDeck(args, false);
}

/** Lobby selection path: always re-reads the deck and records the use timestamp. */
export async function resolveSavedDeckForPlayFresh(
  args: ResolveSavedDeckFreshArgs,
): Promise<ResolveSavedDeckResult> {
  return resolveSavedDeck(args, true);
}

async function resolveSavedDeck(
  args: ResolveSavedDeckArgs,
  fresh: boolean,
): Promise<ResolveSavedDeckResult> {
  const params = new URLSearchParams();
  if (fresh) params.set("fresh", "1");
  if (args.knownLegalityVersion) params.set("knownLegalityVersion", args.knownLegalityVersion);
  if (args.knownRevision !== undefined) params.set("knownRevision", String(args.knownRevision));
  if (args.knownStatus) params.set("knownStatus", args.knownStatus);
  if ("recordUse" in args && args.recordUse === false) params.set("recordUse", "0");
  const query = params.toString();
  const body = await request<{ result?: ResolveSavedDeckResult }>(
    `${deckIdPath(args.deckId)}/resolve${query ? `?${query}` : ""}`,
  );
  return body.result ?? { kind: "missing" };
}

/* ------------------------------------------------------------------ mutations */

/** `savedDecks.upsertSavedDeck` — create when `deckId` is omitted, update otherwise. */
export async function upsertSavedDeck(
  args: UpsertSavedDeckArgs,
): Promise<UpsertSavedDeckResult> {
  const body = await request<{ deck?: UpsertSavedDeckResult }>("/upsert", {
    method: "POST",
    body: args,
  });
  if (!body.deck) {
    throw new SavedDeckApiError(500, "invalid_response", "The deck could not be saved.");
  }
  return body.deck;
}

/** `savedDecks.createSavedDeck` — lobby "Save Deck" for a pasted deck list. */
export async function createSavedDeck(
  args: CreateSavedDeckArgs,
): Promise<CreateSavedDeckResult> {
  const body = await request<{ deck?: CreateSavedDeckResult }>("/create", {
    method: "POST",
    body: args,
  });
  if (!body.deck) {
    throw new SavedDeckApiError(500, "invalid_response", "The deck could not be saved.");
  }
  return body.deck;
}

/** `savedDecks.renameSavedDeck`. */
export async function renameSavedDeck(
  args: RenameSavedDeckArgs,
): Promise<RenameSavedDeckResult> {
  const body = await request<{ result?: RenameSavedDeckResult }>(
    `${deckIdPath(args.deckId)}/rename`,
    {
      method: "POST",
      body: { name: args.name, ...(args.revision === undefined ? {} : { revision: args.revision }) },
    },
  );
  if (!body.result) {
    throw new SavedDeckApiError(500, "invalid_response", "The deck could not be renamed.");
  }
  return body.result;
}

/** `savedDecks.deleteSavedDeck`. */
export async function deleteSavedDeck(deckId: string): Promise<DeleteSavedDeckResult> {
  const body = await request<{ result?: DeleteSavedDeckResult }>(deckIdPath(deckId), {
    method: "DELETE",
  });
  return body.result ?? { id: deckId };
}
