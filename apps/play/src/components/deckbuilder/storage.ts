import {
  emptyDeckSections,
  normalizeDeckSections,
  type DeckSectionKey,
  type ParsedDeckEntry,
} from "@rift/cards";

import type {
  ArtCopiesLayout,
  CatalogGrouping,
  DeckListGroupKey,
  DeckListSortKey,
  DeckbuilderDraftV5,
  DeckbuilderListPreferences,
  FullArtSize,
  PendingAuthAction,
  SortDirection,
  WorkspaceTab,
} from "./types";

export const DRAFT_KEY = "riftatlas_deckbuilder_draft_v1";
export const BOOKMARKS_V1_KEY = "riftatlas_deck_workspace_bookmarks_v1";
export const BOOKMARKS_V2_PREFIX = "riftatlas_deck_workspace_bookmarks_v2:";
export const LIST_PREFERENCES_KEY = "riftatlas_deckbuilder_list_preferences_v1";
export const PENDING_AUTH_ACTION_KEY = "riftatlas_deckbuilder_pending_auth_action_v1";

export const DEFAULT_LIST_PREFERENCES: DeckbuilderListPreferences = {
  catalogGrouping: "none",
  copiesLayout: "stacked",
  fullArtSize: "small",
  deckListGroupKey: "section",
  deckListSortDirection: "asc",
  deckListSortKey: "name",
  deckWorkspaceTab: "list",
};

const SECTION_KEYS: readonly DeckSectionKey[] = [
  "legend",
  "champion",
  "mainDeck",
  "battlefields",
  "runes",
  "sideboard",
];

const FULL_ART_SIZES: readonly FullArtSize[] = [
  "xxsmall",
  "xsmall",
  "small",
  "medium",
  "large",
  "xlarge",
];

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function sessionStorageSafe(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function newId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isSectionKey(value: unknown): value is DeckSectionKey {
  return typeof value === "string" && (SECTION_KEYS as readonly string[]).includes(value);
}

function rawSections(value: unknown): Record<DeckSectionKey, ParsedDeckEntry[]> {
  const sections = emptyDeckSections();
  if (!value || typeof value !== "object") return sections;
  for (const key of SECTION_KEYS) {
    const candidate = (value as Record<string, unknown>)[key];
    if (!Array.isArray(candidate)) continue;
    sections[key] = candidate.flatMap((entry): ParsedDeckEntry[] => {
      if (!entry || typeof entry !== "object") return [];
      const count = Number((entry as { count?: unknown }).count);
      const name = String((entry as { name?: unknown }).name ?? "");
      const cardCode = (entry as { cardCode?: unknown }).cardCode;
      if (!Number.isFinite(count) || count <= 0 || !name.trim()) return [];
      return [
        {
          count: Math.max(0, Math.trunc(count)),
          name: name.trim(),
          ...(typeof cardCode === "string" && cardCode.trim() ? { cardCode: cardCode.trim() } : {}),
        },
      ];
    });
  }
  return sections;
}

export function createEmptyDraft(scopeId: string = newId()): DeckbuilderDraftV5 {
  return {
    version: 5,
    name: "",
    guideHtml: "",
    linkedSavedDeckId: null,
    deckSections: emptyDeckSections(),
    bookmarkScopeId: scopeId,
    selectedSection: "legend",
    lastSavedSignature: null,
    lastSavedStatus: null,
    lastSavedAt: null,
    hasUnsavedChanges: false,
  };
}

/** Is there anything worth prompting about when opening a new builder? */
export function draftHasContent(draft: DeckbuilderDraftV5): boolean {
  return (
    draft.name.trim().length > 0 ||
    draft.guideHtml.trim().length > 0 ||
    Object.values(draft.deckSections).some((entries) => entries.some((entry) => entry.count > 0))
  );
}

export interface ReadDraftResult {
  draft: DeckbuilderDraftV5;
  meaningful: boolean;
}

/** Read the single local draft (versions 1–5), normalizing every field. */
export function readDraft(): ReadDraftResult | null {
  const store = storage();
  if (!store) return null;
  let raw: string | null = null;
  try {
    raw = store.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const version = Number(parsed.version);
    if (![1, 2, 3, 4, 5].includes(version)) return null;
    const scopeId =
      typeof parsed.bookmarkScopeId === "string" && parsed.bookmarkScopeId.trim()
        ? parsed.bookmarkScopeId.trim()
        : newId();
    const deckSections = normalizeDeckSections(
      rawSections(parsed.deckSections ?? parsed.sections ?? parsed.deck),
    );
    const selectedSection = isSectionKey(parsed.selectedSection)
      ? parsed.selectedSection
      : firstSection(deckSections);
    const draft: DeckbuilderDraftV5 = {
      version: 5,
      name: typeof parsed.name === "string" ? parsed.name : "",
      guideHtml: typeof parsed.guideHtml === "string" ? parsed.guideHtml : "",
      linkedSavedDeckId:
        typeof parsed.linkedSavedDeckId === "string" && parsed.linkedSavedDeckId.trim()
          ? parsed.linkedSavedDeckId.trim()
          : null,
      deckSections,
      bookmarkScopeId: scopeId,
      selectedSection,
      lastSavedSignature:
        typeof parsed.lastSavedSignature === "string" ? parsed.lastSavedSignature : null,
      lastSavedStatus:
        parsed.lastSavedStatus === "ready" || parsed.lastSavedStatus === "incomplete"
          ? parsed.lastSavedStatus
          : null,
      lastSavedAt: typeof parsed.lastSavedAt === "number" ? parsed.lastSavedAt : null,
      hasUnsavedChanges: parsed.hasUnsavedChanges === true,
      ...(parsed.startingLegendVacant === true ? { startingLegendVacant: true as const } : {}),
    };
    return { draft, meaningful: draftHasContent(draft) };
  } catch {
    return null;
  }
}

export function writeDraft(draft: DeckbuilderDraftV5): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* quota / privacy mode */
  }
}

export function removeDraft(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function firstSection(
  sections: Record<DeckSectionKey, readonly ParsedDeckEntry[]>,
): DeckSectionKey {
  if (sections.legend.length === 0) return "legend";
  if (sections.champion.length === 0) return "champion";
  return "mainDeck";
}

/* --------------------------------------------------------------- bookmarks */

/** `constructed:local:<scopeId>` or `constructed:saved:<savedDeckId>`. */
export function bookmarkScopeFor(
  draft: Pick<DeckbuilderDraftV5, "linkedSavedDeckId" | "bookmarkScopeId">,
): string {
  return draft.linkedSavedDeckId
    ? `constructed:saved:${draft.linkedSavedDeckId}`
    : `constructed:local:${draft.bookmarkScopeId}`;
}

interface BookmarkFileV1 {
  version?: number;
  cardIds?: unknown;
}

interface BookmarkFileV2 {
  version?: number;
  cardIds?: unknown;
}

function idsOf(value: unknown): Set<string> {
  return new Set(
    Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [],
  );
}

export function readBookmarks(scope: string): Set<string> {
  const store = storage();
  if (!store) return new Set();
  try {
    const current = store.getItem(`${BOOKMARKS_V2_PREFIX}${scope}`);
    if (current) {
      const parsed = JSON.parse(current) as BookmarkFileV2;
      if (parsed && parsed.version === 2) return idsOf(parsed.cardIds);
    }
    const legacy = store.getItem(BOOKMARKS_V1_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as BookmarkFileV1;
      const ids = idsOf(parsed?.cardIds);
      if (ids.size > 0) {
        writeBookmarks(scope, ids);
        store.removeItem(BOOKMARKS_V1_KEY);
      }
      return ids;
    }
  } catch {
    /* ignore corrupted bookmark files */
  }
  return new Set();
}

export function writeBookmarks(scope: string, ids: ReadonlySet<string>): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(
      `${BOOKMARKS_V2_PREFIX}${scope}`,
      JSON.stringify({ version: 2, cardIds: [...ids] }),
    );
  } catch {
    /* ignore */
  }
}

export function removeBookmarks(scope: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(`${BOOKMARKS_V2_PREFIX}${scope}`);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------- preferences */

function normalizeGrouping(value: unknown): CatalogGrouping | null {
  return value === "domain" || value === "type" || value === "none" ? value : null;
}

function normalizeSortKey(value: unknown): DeckListSortKey | null {
  return value === "name" ||
    value === "type" ||
    value === "energy" ||
    value === "power" ||
    value === "domain" ||
    value === "copies"
    ? value
    : null;
}

function normalizeGroupKey(value: unknown): DeckListGroupKey | null {
  return value === "section" ||
    value === "type" ||
    value === "energy" ||
    value === "power" ||
    value === "domain"
    ? value
    : null;
}

export function readListPreferences(): DeckbuilderListPreferences {
  const store = storage();
  if (!store) return { ...DEFAULT_LIST_PREFERENCES };
  try {
    const raw = store.getItem(LIST_PREFERENCES_KEY);
    if (!raw) return { ...DEFAULT_LIST_PREFERENCES };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const grouping =
      normalizeGrouping(parsed.catalogGrouping) ?? DEFAULT_LIST_PREFERENCES.catalogGrouping;
    const copiesLayout: ArtCopiesLayout =
      (parsed.artCopiesLayout ?? parsed.copiesLayout) === "separate" ? "separate" : "stacked";
    const sizeCandidate = String(parsed.fullArtSize ?? parsed.artSize ?? "small") as FullArtSize;
    const fullArtSize = FULL_ART_SIZES.includes(sizeCandidate)
      ? sizeCandidate
      : DEFAULT_LIST_PREFERENCES.fullArtSize;
    const groupKey = normalizeGroupKey(parsed.groupKey ?? parsed.deckListGroupKey) ?? "section";
    const sortDirection: SortDirection =
      (parsed.sortDirection ?? parsed.deckListSortDirection) === "desc" ? "desc" : "asc";
    const sortKey =
      normalizeSortKey(parsed.sortKey ?? parsed.deckListSortKey) ??
      DEFAULT_LIST_PREFERENCES.deckListSortKey;
    const workspaceTab: Exclude<WorkspaceTab, "stats"> =
      (parsed.workspaceTab ?? parsed.deckWorkspaceTab) === "fullArt" ? "fullArt" : "list";
    return {
      catalogGrouping: grouping,
      copiesLayout,
      fullArtSize,
      deckListGroupKey: groupKey,
      deckListSortDirection: sortDirection,
      deckListSortKey: sortKey,
      deckWorkspaceTab: workspaceTab,
    };
  } catch {
    return { ...DEFAULT_LIST_PREFERENCES };
  }
}

export function writeListPreferences(preferences: DeckbuilderListPreferences): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(
      LIST_PREFERENCES_KEY,
      JSON.stringify({
        catalogGrouping: preferences.catalogGrouping,
        artCopiesLayout: preferences.copiesLayout,
        fullArtSize: preferences.fullArtSize,
        groupKey: preferences.deckListGroupKey,
        sortDirection: preferences.deckListSortDirection,
        sortKey: preferences.deckListSortKey,
        workspaceTab: preferences.deckWorkspaceTab,
      }),
    );
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------- pending auth action */

export function readPendingAuthAction(): PendingAuthAction | null {
  const store = sessionStorageSafe();
  if (!store) return null;
  try {
    const raw = store.getItem(PENDING_AUTH_ACTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingAuthAction;
    if (parsed?.version !== 1) return null;
    if (parsed.kind !== "save_deck" && parsed.kind !== "publish_deck") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePendingAuthAction(action: PendingAuthAction | null): void {
  const store = sessionStorageSafe();
  if (!store) return;
  try {
    if (action) store.setItem(PENDING_AUTH_ACTION_KEY, JSON.stringify(action));
    else store.removeItem(PENDING_AUTH_ACTION_KEY);
  } catch {
    /* ignore */
  }
}
