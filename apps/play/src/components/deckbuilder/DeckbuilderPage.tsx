"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  decodeDeckCodeToDecklist,
  encodeDecklistToDeckCode,
  exportDeckText,
  isBannedInStandardConstructed,
  isDeckReadyForMatch,
  normalizeSections,
  parseDeckText,
  resolveCard,
  type Card,
  type DeckSectionKey,
  type DeckSections,
  type ParsedDeckEntry,
} from "@rift/cards";

import { AccountDialog } from "@/components/shell/AccountDialog";
import { ToastStack } from "@/components/deckbuilder/ui";
import {
  SavedDeckApiError,
  getSavedDeckEditorSnapshot,
  upsertSavedDeck,
  useIdentity,
  type SavedDeckEditorSnapshot,
} from "@/runtime";

import {
  applyCatalogFilters,
  buildFacets,
  groupCatalogCards,
  matchesSearch,
  poolForSection,
  sortCatalogCards,
} from "./catalog";
import { BuilderHeader } from "./BuilderHeader";
import { CardDetailDialog } from "./CardDetailDialog";
import { CatalogPanel } from "./CatalogPanel";
import { DeckImportDialog } from "./DeckImportDialog";
import { DeckWorkspace, type WorkspaceHandlers } from "./DeckWorkspace";
import { GuideDialog } from "./GuideDialog";
import { ArtPicker, DiscardDialog, ExportMenu, copyText } from "./dialogs";
import {
  addCardToSection,
  computedDeckName,
  deckNamePlaceholder,
  decrementEntry,
  draftFromState,
  draftSignature,
  entryIdentity,
  getAddAvailability as addAvailability,
  incrementEntry,
  moveEntry,
  parseDeckSections,
  replacePrint,
  sectionNameCount,
} from "./draft";
import {
  bookmarkScopeFor,
  createEmptyDraft,
  firstSection as firstDraftSection,
  newId,
  readBookmarks,
  readDraft,
  readListPreferences,
  removeBookmarks,
  removeDraft,
  writeBookmarks,
  writeDraft,
  writeListPreferences,
  writePendingAuthAction,
} from "./storage";
import { T, mobileSummary } from "./strings";
import { createEmptyDraft as emptyDraft } from "./storage";
import type {
  ArtCopiesLayout,
  BuilderToast,
  CatalogFilters,
  CatalogGrouping,
  CatalogSortKey,
  DeckListGroupKey,
  DeckListSortKey,
  DeckbuilderDraftV5,
  DeckbuilderListPreferences,
  FullArtSize,
  SavedDeckMeta,
  SortDirection,
  WorkspaceTab,
} from "./types";
import { EMPTY_FILTERS } from "./types";

export interface DeckbuilderPageProps {
  mode: "new" | "saved";
  savedDeckId?: string;
}

interface ContextState {
  query: string;
  filters: CatalogFilters;
  visible: number;
}

const PAGE_SIZE = 24;

function contextIdFor(section: DeckSectionKey): DeckSectionKey {
  return section === "sideboard" ? "mainDeck" : section;
}

function defaultContext(): ContextState {
  return { query: "", filters: { ...EMPTY_FILTERS }, visible: PAGE_SIZE };
}

function sectionsFromSnapshot(snapshot: SavedDeckEditorSnapshot): DeckSections {
  const content = snapshot.deckContent;
  if (content.kind === "parsedDeck") {
    return normalizeSections(content.parsedDeck.sections);
  }
  try {
    const decoded = decodeDeckCodeToDecklist(content.deckCode);
    return normalizeSections(
      parseDeckText(decoded.decklistRaw, { validateCatalog: true }).sections,
    );
  } catch {
    return emptyDraft().deckSections;
  }
}

function savedMetaFromSnapshot(snapshot: SavedDeckEditorSnapshot): SavedDeckMeta {
  return {
    id: snapshot.id,
    name: snapshot.name,
    status: snapshot.status,
    legalityVersion: snapshot.legalityVersion,
    revision: snapshot.revision,
    updatedAt: snapshot.updatedAt,
    publishedDeckId: snapshot.publishedDeckId ?? null,
  };
}

function metaFromDraft(draft: DeckbuilderDraftV5): SavedDeckMeta | null {
  if (!draft.linkedSavedDeckId) return null;
  return {
    id: draft.linkedSavedDeckId,
    name: draft.name,
    status: draft.lastSavedStatus ?? "incomplete",
    legalityVersion: "",
    revision: 0,
    updatedAt: draft.lastSavedAt ?? Date.now(),
  };
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof SavedDeckApiError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function DeckbuilderPage({ mode, savedDeckId }: DeckbuilderPageProps) {
  const identityApi = useIdentity();
  const [clientReady, setClientReady] = useState(false);
  const signedIn = clientReady && identityApi.identity.kind === "account";

  useEffect(() => {
    setClientReady(true);
  }, []);

  const [hydrated, setHydrated] = useState(false);
  const [routeLoading, setRouteLoading] = useState(mode === "saved");

  const [name, setName] = useState("");
  const [guideHtml, setGuideHtml] = useState("");
  const [sections, setSections] = useState<DeckSections>(() => emptyDraft().deckSections);
  const [linkedSavedDeckId, setLinkedSavedDeckId] = useState<string | null>(null);
  const [bookmarkScopeId, setBookmarkScopeId] = useState(() => newId());
  const [selectedSection, setSelectedSection] = useState<DeckSectionKey>("legend");
  const [startingLegendVacant, setStartingLegendVacant] = useState(false);
  const [lastSavedSignature, setLastSavedSignature] = useState<string | null>(null);
  const [lastSavedStatus, setLastSavedStatus] = useState<"ready" | "incomplete" | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [savedMeta, setSavedMeta] = useState<SavedDeckMeta | null>(null);
  const [saving, setSaving] = useState(false);

  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("list");
  const [catalogState, setCatalogState] = useState<Record<string, ContextState>>({});
  const [catalogGrouping, setCatalogGrouping] = useState<CatalogGrouping>("none");
  const [catalogSortKey, setCatalogSortKey] = useState<CatalogSortKey>("name");
  const [catalogSortDirection, setCatalogSortDirection] = useState<SortDirection>("asc");
  const [groupKey, setGroupKey] = useState<DeckListGroupKey>("section");
  const [listSortKey, setListSortKey] = useState<DeckListSortKey>("name");
  const [listSortDirection, setListSortDirection] = useState<SortDirection>("asc");
  const [copiesLayout, setCopiesLayout] = useState<ArtCopiesLayout>("stacked");
  const [fullArtSize, setFullArtSize] = useState<FullArtSize>("small");
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const [catalogPaneWidth, setCatalogPaneWidth] = useState(58);
  const [deckOnly, setDeckOnly] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileNameOpen, setMobileNameOpen] = useState(false);

  const [filterOpen, setFilterOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [detailCard, setDetailCard] = useState<Card | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [artPicker, setArtPicker] = useState<{
    section: DeckSectionKey;
    entry: ParsedDeckEntry;
  } | null>(null);

  const [accountOpen, setAccountOpen] = useState(false);
  const [accountReason, setAccountReason] = useState<string | null>(null);
  const [accountMode, setAccountMode] = useState<"login" | "register">("login");
  const pendingAuthRef = useRef<"save" | null>(null);

  const [toasts, setToasts] = useState<BuilderToast[]>([]);
  const toastIdRef = useRef(0);
  const pushToast = useCallback((message: string, tone: BuilderToast["tone"] = "info") => {
    toastIdRef.current += 1;
    const id = toastIdRef.current;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4400);
  }, []);

  const [bookmarks, setBookmarks] = useState<Set<string>>(() => new Set());
  const bookmarkScope = linkedSavedDeckId
    ? `constructed:saved:${linkedSavedDeckId}`
    : `constructed:local:${bookmarkScopeId}`;

  const [dragState, setDragState] = useState<
    | { source: "catalog"; card: Card }
    | { source: "deck"; section: DeckSectionKey; entry: ParsedDeckEntry }
    | null
  >(null);
  const [dragOverSection, setDragOverSection] = useState<DeckSectionKey | null>(null);
  const [dragOverCatalog, setDragOverCatalog] = useState(false);

  const startHydratedRef = useRef(false);
  const lastDraftRef = useRef<DeckbuilderDraftV5 | null>(null);

  /* ------------------------------------------------------------- hydration */

  useEffect(() => {
    if (!clientReady || identityApi.loading || startHydratedRef.current) return;
    startHydratedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const clearDraft = params.get("clearDraft") === "1";
    const local = clearDraft ? null : readDraft();
    if (clearDraft) {
      const cleared = readDraft();
      if (cleared) removeBookmarks(bookmarkScopeFor(cleared.draft));
      removeDraft();
      const url = new URL(window.location.href);
      url.searchParams.delete("clearDraft");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }

    const hydrateFromDraft = (draft: DeckbuilderDraftV5) => {
      setName(draft.name);
      setGuideHtml(draft.guideHtml);
      setSections(normalizeSections(draft.deckSections));
      setLinkedSavedDeckId(draft.linkedSavedDeckId);
      setBookmarkScopeId(draft.bookmarkScopeId);
      setSelectedSection(draft.selectedSection);
      setStartingLegendVacant(draft.startingLegendVacant === true);
      setLastSavedSignature(draft.lastSavedSignature);
      setLastSavedStatus(draft.lastSavedStatus);
      setLastSavedAt(draft.lastSavedAt);
      setSavedMeta(metaFromDraft(draft));
      setParamsFromPrefs();
    };
    const setEmpty = () => {
      const draft = createEmptyDraft();
      setName("");
      setGuideHtml("");
      setSections(draft.deckSections);
      setLinkedSavedDeckId(null);
      setBookmarkScopeId(draft.bookmarkScopeId);
      setSelectedSection("legend");
      setStartingLegendVacant(false);
      setLastSavedSignature(null);
      setLastSavedStatus(null);
      setLastSavedAt(null);
      setSavedMeta(null);
      setParamsFromPrefs();
    };
    const setParamsFromPrefs = () => {
      const prefs = readListPreferences();
      setCatalogGrouping(prefs.catalogGrouping);
      setWorkspaceTab(prefs.deckWorkspaceTab);
      setCopiesLayout(prefs.copiesLayout);
      setFullArtSize(prefs.fullArtSize);
      setGroupKey(prefs.deckListGroupKey);
      setListSortKey(prefs.deckListSortKey);
      setListSortDirection(prefs.deckListSortDirection);
      setPrefsLoaded(true);
    };
    const hydrateFromSaved = (snapshot: SavedDeckEditorSnapshot) => {
      const nextSections = sectionsFromSnapshot(snapshot);
      setName(snapshot.name);
      setGuideHtml(snapshot.guideHtml);
      setSections(nextSections);
      setLinkedSavedDeckId(snapshot.id);
      setBookmarkScopeId(newId());
      setSelectedSection(firstDraftSection(nextSections));
      setStartingLegendVacant(false);
      setLastSavedSignature(draftSignature(snapshot.name, snapshot.guideHtml, nextSections));
      setLastSavedStatus(snapshot.status);
      setLastSavedAt(snapshot.updatedAt);
      setSavedMeta(savedMetaFromSnapshot(snapshot));
      setParamsFromPrefs();
    };

    if (mode === "saved" && savedDeckId) {
      setRouteLoading(true);
      if (!signedIn) {
        pushToast(T.signInToLoadSavedDeck, "info");
        if (local) hydrateFromDraft(local.draft);
        else setEmpty();
        setRouteLoading(false);
        setHydrated(true);
        return;
      }
      void (async () => {
        try {
          const snapshot = await getSavedDeckEditorSnapshot(savedDeckId);
          if (snapshot) {
            hydrateFromSaved(snapshot);
          } else {
            pushToast(T.couldNotLoadDeck, "error");
            if (local) hydrateFromDraft(local.draft);
            else setEmpty();
          }
        } catch (error) {
          pushToast(errorMessage(error, T.couldNotLoadDeck), "error");
          if (local) hydrateFromDraft(local.draft);
          else setEmpty();
        } finally {
          setRouteLoading(false);
          setHydrated(true);
        }
      })();
      return;
    }

    if (local) hydrateFromDraft(local.draft);
    else setEmpty();
    setRouteLoading(false);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientReady, identityApi.loading, mode, savedDeckId, signedIn, pushToast]);

  /* ------------------------------------------------------------- prefs/bookmarks */

  useEffect(() => {
    if (!hydrated) return;
    setBookmarks(readBookmarks(bookmarkScope));
  }, [bookmarkScope, hydrated]);

  useEffect(() => {
    if (!hydrated || !prefsLoaded) return;
    const prefs: DeckbuilderListPreferences = {
      catalogGrouping,
      copiesLayout,
      fullArtSize,
      deckListGroupKey: groupKey,
      deckListSortDirection: listSortDirection,
      deckListSortKey: listSortKey,
      deckWorkspaceTab: workspaceTab === "stats" ? "list" : workspaceTab,
    };
    writeListPreferences(prefs);
  }, [
    hydrated,
    prefsLoaded,
    catalogGrouping,
    copiesLayout,
    fullArtSize,
    groupKey,
    listSortDirection,
    listSortKey,
    workspaceTab,
  ]);

  /* ------------------------------------------------------------- draft autosave */

  useEffect(() => {
    if (!hydrated) return;
    const draft = draftFromState({
      name,
      guideHtml,
      linkedSavedDeckId,
      sections,
      bookmarkScopeId,
      selectedSection,
      lastSavedSignature,
      lastSavedStatus,
      lastSavedAt,
      startingLegendVacant,
    });
    lastDraftRef.current = draft;
    const timeout = window.setTimeout(() => writeDraft(draft), 200);
    return () => window.clearTimeout(timeout);
  }, [
    hydrated,
    name,
    guideHtml,
    linkedSavedDeckId,
    sections,
    bookmarkScopeId,
    selectedSection,
    lastSavedSignature,
    lastSavedStatus,
    lastSavedAt,
    startingLegendVacant,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    const flush = () => {
      if (lastDraftRef.current) writeDraft(lastDraftRef.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hydrated]);

  const toggleBookmark = useCallback(
    (card: Card) => {
      const next = new Set(bookmarks);
      if (next.has(card.id)) next.delete(card.id);
      else next.add(card.id);
      setBookmarks(next);
      writeBookmarks(bookmarkScope, next);
    },
    [bookmarks, bookmarkScope],
  );

  /* ------------------------------------------------------------- derived deck */

  const parsed = useMemo(
    () => parseDeckSections(sections, { startingLegendVacant }),
    [sections, startingLegendVacant],
  );
  const totals = parsed.totals;
  const readyResult = useMemo(
    () => isDeckReadyForMatch(parsed, { format: "standard-constructed" }),
    [parsed],
  );
  const ready = readyResult.valid;
  const issues = readyResult.reasons;

  const signature = useMemo(
    () => draftSignature(name, guideHtml, sections),
    [name, guideHtml, sections],
  );
  const dirty = lastSavedSignature !== null && lastSavedSignature !== signature;
  const totalCardCount = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const hasCards = totalCardCount > 0;

  const statusText = identityApi.loading
    ? T.checkingSignIn
    : saving
      ? T.savingChanges
      : linkedSavedDeckId
        ? dirty
          ? T.unsavedChanges
          : T.saved
        : hasCards
          ? T.localDraftOnly
          : T.startBuildingToSave;
  const statusTone = dirty
    ? "text-amber-800"
    : linkedSavedDeckId && !dirty
      ? "text-emerald-700"
      : "text-muted-foreground";
  const displayName =
    name.trim() || computedDeckName(sections, startingLegendVacant) || T.savedDeck;
  const namePlaceholder = deckNamePlaceholder(sections, startingLegendVacant);
  const contextId = contextIdFor(selectedSection);
  const activeCatalogState = catalogState[contextId] ?? defaultContext();
  const legendEntry = startingLegendVacant ? undefined : sections.legend[0];

  const pool = useMemo(
    () => poolForSection(selectedSection, legendEntry),
    [selectedSection, legendEntry],
  );
  const searchedPool = useMemo(
    () => pool.filter((card) => matchesSearch(card, activeCatalogState.query)),
    [pool, activeCatalogState.query],
  );
  const catalogContext = useMemo(
    () => ({ section: selectedSection, legend: legendEntry, sections, bookmarks }),
    [selectedSection, legendEntry, sections, bookmarks],
  );
  const filteredPool = useMemo(
    () => applyCatalogFilters(searchedPool, activeCatalogState.filters, catalogContext),
    [searchedPool, activeCatalogState.filters, catalogContext],
  );
  const sortedPool = useMemo(
    () => sortCatalogCards(filteredPool, catalogSortKey, catalogSortDirection),
    [filteredPool, catalogSortKey, catalogSortDirection],
  );
  const visibleCount = Math.min(activeCatalogState.visible, sortedPool.length);
  const visiblePool = useMemo(() => sortedPool.slice(0, visibleCount), [sortedPool, visibleCount]);
  const catalogGroups = useMemo(
    () => groupCatalogCards(visiblePool, catalogGrouping),
    [visiblePool, catalogGrouping],
  );
  const facetGroups = useMemo(
    () => buildFacets(pool, searchedPool, activeCatalogState.filters, catalogContext),
    [pool, searchedPool, activeCatalogState.filters, catalogContext],
  );

  const updateContext = useCallback(
    (patch: Partial<ContextState>, options: { resetPage?: boolean } = {}) => {
      setCatalogState((current) => {
        const base = current[contextId] ?? defaultContext();
        return {
          ...current,
          [contextId]: {
            ...base,
            ...patch,
            ...(options.resetPage ? { visible: PAGE_SIZE } : {}),
          },
        };
      });
    },
    [contextId],
  );

  const setSelected = useCallback((section: DeckSectionKey) => {
    setSelectedSection(section);
  }, []);

  /* ------------------------------------------------------------- handlers */

  const handleAddCard = useCallback(
    (card: Card) => {
      let result;
      if (selectedSection === "legend" && startingLegendVacant) {
        result = {
          sections: {
            ...sections,
            legend: [
              { count: 1, name: card.name, cardCode: card.id },
              ...sections.legend.filter(
                (entry) => entryIdentity(entry) !== `code:${card.id}` && entry.name !== card.name,
              ),
            ],
          },
          nextSection: "champion" as DeckSectionKey,
          startingLegendVacant: false,
        };
      } else {
        result = addCardToSection(sections, selectedSection, card, { startingLegendVacant });
      }
      setSections(result.sections);
      if (result.startingLegendVacant !== undefined) {
        setStartingLegendVacant(result.startingLegendVacant);
      } else if (result.nextSection) {
        setStartingLegendVacant(false);
      }
      if (result.toast) pushToast(result.toast, "info");
      if (result.nextSection) setSelectedSection(result.nextSection);
    },
    [sections, selectedSection, startingLegendVacant, pushToast],
  );

  const handleIncrement = useCallback(
    (section: DeckSectionKey, entry: ParsedDeckEntry) => {
      const result = incrementEntry(sections, section, entry);
      setSections(result.sections);
      if (result.toast) pushToast(result.toast, "info");
    },
    [sections, pushToast],
  );

  const handleDecrement = useCallback(
    (section: DeckSectionKey, entry: ParsedDeckEntry) => {
      const wasStarting =
        section === "legend" &&
        !startingLegendVacant &&
        sections.legend[0] !== undefined &&
        entryIdentity(sections.legend[0]) === entryIdentity(entry);
      const next = decrementEntry(sections, section, entry);
      setSections(next);
      if (section === "legend") {
        if (next.legend.length === 0) setStartingLegendVacant(false);
        else if (wasStarting && next.legend.length > 0) {
          const neekoInDeck =
            next.mainDeck.some((deckEntry) => deckEntry.name.toLowerCase().startsWith("neeko")) ||
            next.sideboard.some((deckEntry) => deckEntry.name.toLowerCase().startsWith("neeko"));
          if (neekoInDeck) setStartingLegendVacant(true);
        }
      }
    },
    [sections, startingLegendVacant],
  );

  const handleMove = useCallback(
    (section: DeckSectionKey, entry: ParsedDeckEntry) => {
      if (section !== "mainDeck" && section !== "sideboard") return;
      const result = moveEntry(sections, section, entry);
      setSections(result.sections);
      if (result.toast) pushToast(result.toast, "info");
    },
    [sections, pushToast],
  );

  const openDetailsForEntry = useCallback(
    (entry: ParsedDeckEntry) => {
      const card = resolveCard(entry.cardCode, entry.name);
      if (!card) {
        pushToast(T.couldNotLoadDeck, "error");
        return;
      }
      setDetailCard(card);
      setDetailOpen(true);
    },
    [pushToast],
  );

  const openArtForEntry = useCallback((section: DeckSectionKey, entry: ParsedDeckEntry) => {
    setArtPicker({ section, entry });
  }, []);

  const selectPrint = useCallback(
    (section: DeckSectionKey, entry: ParsedDeckEntry, print: Card) => {
      setSections((current) =>
        replacePrint(current, section, entry, { name: print.name, cardCode: print.id }),
      );
    },
    [],
  );

  const cardFor = useCallback(
    (entry: ParsedDeckEntry) => resolveCard(entry.cardCode, entry.name),
    [],
  );

  const canIncrement = useCallback(
    (section: DeckSectionKey, entry: ParsedDeckEntry) => {
      if (section === "legend" || section === "champion") return false;
      return addAvailability(
        { name: entry.name, ...(entry.cardCode ? { cardCode: entry.cardCode } : {}) },
        section,
        sections,
      ).ok;
    },
    [sections],
  );

  const emptyAction = useCallback((section: DeckSectionKey) => {
    setSelectedSection(section);
    if (window.matchMedia("(max-width: 1023px)").matches) setDrawerOpen(false);
  }, []);

  const setEmptySection = useCallback(
    (section: DeckSectionKey) => {
      emptyAction(section);
    },
    [emptyAction],
  );

  const deckCountFor = useCallback(
    (card: Card) => sectionNameCount(sections, selectedSection, card.name),
    [sections, selectedSection],
  );

  /* --------------------------------------------------------------- save/play */

  const saveDeck = useCallback(
    async (
      options: { silent?: boolean; asNew?: boolean } = {},
    ): Promise<{ id: string; status: "ready" | "incomplete" } | null> => {
      if (!signedIn) return null;
      const saveName = (name.trim() || namePlaceholder.trim()).slice(0, 120);
      if (!saveName) {
        pushToast(T.deckNameRequired, "error");
        return null;
      }
      setSaving(true);
      try {
        const normalized = normalizeSections(sections);
        const result = await upsertSavedDeck({
          ...(linkedSavedDeckId && !options.asNew ? { deckId: linkedSavedDeckId } : {}),
          name: saveName,
          deckSections: normalized,
          guideHtml,
          ...(linkedSavedDeckId && savedMeta && savedMeta.revision > 0
            ? { revision: savedMeta.revision }
            : {}),
        });
        const savedAt = Date.now();
        const savedSignature = draftSignature(result.name, result.guideHtml, normalized);
        setName(result.name);
        setGuideHtml(result.guideHtml);
        setSections(normalized);
        setLinkedSavedDeckId(result.id);
        setLastSavedSignature(savedSignature);
        setLastSavedStatus(result.status);
        setLastSavedAt(savedAt);
        setSavedMeta({
          id: result.id,
          name: result.name,
          status: result.status,
          legalityVersion: result.legalityVersion,
          revision: result.revision,
          updatedAt: savedAt,
        });
        if (!linkedSavedDeckId || options.asNew) {
          window.history.replaceState({}, "", `/decks/${encodeURIComponent(result.id)}`);
        }
        if (!options.silent) pushToast(T.savedToLibrary, "success");
        return { id: result.id, status: result.status };
      } catch (error) {
        pushToast(errorMessage(error, T.couldNotSaveDeck), "error");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [signedIn, name, namePlaceholder, sections, guideHtml, linkedSavedDeckId, savedMeta, pushToast],
  );

  const requireAccountForSave = useCallback(() => {
    pendingAuthRef.current = "save";
    writePendingAuthAction({
      version: 1,
      kind: "save_deck",
      suggestedName: name.trim() || namePlaceholder,
    });
    setAccountReason(T.signInDeckFeatures);
    setAccountMode("login");
    setAccountOpen(true);
  }, [name, namePlaceholder]);

  const handleSave = useCallback(() => {
    if (!signedIn) {
      requireAccountForSave();
      return;
    }
    void saveDeck();
  }, [signedIn, requireAccountForSave, saveDeck]);

  const playInSimulator = useCallback(async () => {
    if (!ready) {
      pushToast(T.incompleteDeckSaveNote, "info");
      return;
    }
    if (signedIn) {
      let deckId = linkedSavedDeckId;
      if (!deckId || dirty) {
        const saved = await saveDeck({ silent: true });
        if (!saved) return;
        deckId = saved.id;
      }
      window.location.assign(`/?savedDeckId=${encodeURIComponent(deckId)}`);
      return;
    }
    try {
      const code = encodeDecklistToDeckCode({ sections });
      window.location.assign(`/?deckCode=${encodeURIComponent(code)}`);
    } catch {
      pushToast(T.deckCodeUnsupported, "error");
    }
  }, [ready, signedIn, linkedSavedDeckId, dirty, saveDeck, sections, pushToast]);

  // Replay a requested save after the account dialog signs in.
  useEffect(() => {
    if (!signedIn || !pendingAuthRef.current) return;
    const action = pendingAuthRef.current;
    pendingAuthRef.current = null;
    writePendingAuthAction(null);
    if (action === "save") void saveDeck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  /* -------------------------------------------------------------- import/export */

  const handleImport = useCallback(
    (imported: DeckSections) => {
      const normalized = normalizeSections(imported);
      setSections(normalized);
      setStartingLegendVacant(false);
      setSelectedSection(firstDraftSection(normalized));
      pushToast("Deck imported.", "success");
    },
    [pushToast],
  );

  const copyDecklist = useCallback(async () => {
    const ok = await copyText(exportDeckText(sections));
    pushToast(ok ? T.decklistCopied : T.couldNotCopyDecklist, ok ? "success" : "error");
  }, [sections, pushToast]);

  const copyDeckCode = useCallback(async () => {
    try {
      const code = encodeDecklistToDeckCode({ sections });
      const ok = await copyText(code);
      pushToast(ok ? T.deckCodeCopied : T.couldNotCopyDeckCode, ok ? "success" : "error");
    } catch {
      pushToast(T.deckCodeUnsupported, "error");
    }
  }, [sections, pushToast]);

  const discardDraft = useCallback(() => {
    removeBookmarks(bookmarkScope);
    removeDraft();
    writePendingAuthAction(null);
    window.location.assign("/");
  }, [bookmarkScope]);

  /* ------------------------------------------------------------------- drag */

  const handleSectionDragOver = useCallback(
    (section: DeckSectionKey, event: React.DragEvent) => {
      if (!dragState) return;
      const valid =
        dragState.source === "catalog"
          ? section === "mainDeck" || section === "sideboard"
          : (dragState.section === "mainDeck" || dragState.section === "sideboard") &&
            (section === "mainDeck" || section === "sideboard");
      if (!valid) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = dragState.source === "catalog" ? "copy" : "move";
      setDragOverSection(section);
    },
    [dragState],
  );

  const clearDrag = useCallback(() => {
    setDragState(null);
    setDragOverSection(null);
    setDragOverCatalog(false);
  }, []);

  const handleSectionDrop = useCallback(
    (section: DeckSectionKey, event: React.DragEvent) => {
      event.preventDefault();
      if (!dragState) {
        clearDrag();
        return;
      }
      if (dragState.source === "catalog") {
        if (section === "mainDeck" || section === "sideboard") {
          const result = addCardToSection(sections, section, dragState.card, {
            startingLegendVacant,
          });
          setSections(result.sections);
          if (result.toast) pushToast(result.toast, "info");
        }
      } else if (
        (dragState.section === "mainDeck" && section === "sideboard") ||
        (dragState.section === "sideboard" && section === "mainDeck")
      ) {
        const result = moveEntry(sections, dragState.section, dragState.entry);
        setSections(result.sections);
        if (result.toast) pushToast(result.toast, "info");
      }
      clearDrag();
    },
    [dragState, sections, startingLegendVacant, pushToast, clearDrag],
  );

  const handleCatalogDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (dragState?.source === "deck") {
        setSections(decrementEntry(sections, dragState.section, dragState.entry));
      }
      clearDrag();
    },
    [dragState, sections, clearDrag],
  );

  const handleCatalogDragOver = useCallback(
    (event: React.DragEvent) => {
      if (!dragState) return;
      event.preventDefault();
      setDragOverCatalog(true);
    },
    [dragState],
  );

  /* --------------------------------------------------------------- account */

  const closeAccount = useCallback(() => {
    setAccountOpen(false);
    setAccountReason(null);
    if (pendingAuthRef.current) {
      pendingAuthRef.current = null;
      writePendingAuthAction(null);
    }
  }, []);

  /* ---------------------------------------------------------------- render */

  const workspaceHandlers: WorkspaceHandlers = {
    cardFor,
    canIncrement,
    onIncrement: handleIncrement,
    onDecrement: handleDecrement,
    onMove: handleMove,
    onViewEntry: (_section, entry) => openDetailsForEntry(entry),
    onChooseArt: openArtForEntry,
    onEmptyAction: setEmptySection,
    onDragEntryStart: (section, entry) => {
      setDragState({ source: "deck", section, entry });
      setDragOverSection(section);
    },
    onDragEnd: clearDrag,
    onSectionDragOver: handleSectionDragOver,
    onSectionDrop: handleSectionDrop,
    dragOverSection,
  };

  const workspaceProps = {
    sections,
    totals,
    startingLegendVacant,
    name,
    onNameChange: setName,
    namePlaceholder,
    statusText,
    statusTone,
    saving,
    canSave: !saving && !identityApi.loading && (!linkedSavedDeckId || dirty),
    onSave: handleSave,
    onOpenImport: () => setImportOpen(true),
    onOpenExport: () => setExportOpen(true),
    exportOpen,
    onExportOpenChange: setExportOpen,
    exportMenu: (
      <ExportMenu
        onCopyDecklist={() => void copyDecklist()}
        onCopyDeckCode={() => void copyDeckCode()}
        onClose={() => setExportOpen(false)}
      />
    ),
    onOpenGuide: () => setGuideOpen(true),
    onOpenDiscard: () => setDiscardOpen(true),
    onPlay: () => void playInSimulator(),
    ready,
    issues,
    workspaceTab,
    onWorkspaceTabChange: setWorkspaceTab,
    groupKey,
    sortKey: listSortKey,
    sortDirection: listSortDirection,
    onGroupKeyChange: setGroupKey,
    onSortKeyChange: setListSortKey,
    onSortDirectionChange: setListSortDirection,
    handlers: workspaceHandlers,
    copiesLayout,
    fullArtSize,
    onCopiesLayoutChange: setCopiesLayout,
    onFullArtSizeChange: setFullArtSize,
    deckOnly,
    onToggleDeckOnly: () => setDeckOnly((current) => !current),
  };

  if (!hydrated) {
    return (
      <div className="deckbuilder-root">
        <BuilderHeader
          signedIn={signedIn}
          accountName={identityApi.identity.name}
          onSignIn={() => {
            setAccountMode("login");
            setAccountReason(T.signInDeckFeatures);
            setAccountOpen(true);
          }}
          onSignUp={() => {
            setAccountMode("register");
            setAccountReason(T.signInDeckFeatures);
            setAccountOpen(true);
          }}
          onSignOut={() => identityApi.signOut()}
        />
        <div className="flex min-h-[60vh] items-center justify-center px-4 text-sm text-muted-foreground">
          {routeLoading ? T.loadingSavedDeck : T.restoringDraft}
        </div>
      </div>
    );
  }

  return (
    <div className="deckbuilder-root">
      <BuilderHeader
        signedIn={signedIn}
        accountName={identityApi.identity.name}
        onSignIn={() => {
          setAccountMode("login");
          setAccountReason(T.signInDeckFeatures);
          setAccountOpen(true);
        }}
        onSignUp={() => {
          setAccountMode("register");
          setAccountReason(T.signInDeckFeatures);
          setAccountOpen(true);
        }}
        onSignOut={() => {
          identityApi.signOut();
          pendingAuthRef.current = null;
          pushToast("Signed out", "info");
        }}
      />

      <main className="flex w-full max-w-none flex-col gap-6 px-2 pb-28 pt-0 sm:px-4 md:px-6 lg:px-8 lg:pb-0">
        <p className="sr-only">
          Riftbound deck builder. Search the card catalog, build Legend, Champion, Main Deck,
          Battlefields, Sideboard and Runes, then save or play the deck in the simulator.
        </p>
        <section
          className={`db-split ${deckOnly ? "db-deck-only" : ""}`}
          style={{ ["--db-catalog-width" as string]: `${catalogPaneWidth}%` }}
        >
          {!deckOnly ? (
            <div
              data-deckbuilder-drop-target="catalog"
              className={`relative min-w-0 transition-[background-color,box-shadow] ${
                dragOverCatalog ? "db-drag-target" : ""
              }`}
              onDragOver={handleCatalogDragOver}
              onDragLeave={() => setDragOverCatalog(false)}
              onDrop={handleCatalogDrop}
            >
              <div className="pr-4">
                <CatalogPanel
                  section={selectedSection}
                  onSelectSection={setSelected}
                  legend={legendEntry}
                  sections={sections}
                  search={activeCatalogState.query}
                  onSearchChange={(query) => updateContext({ query }, { resetPage: true })}
                  filters={activeCatalogState.filters}
                  onToggleFilter={(facet, value) =>
                    updateContext(
                      {
                        filters: {
                          ...activeCatalogState.filters,
                          [facet]: activeCatalogState.filters[facet].includes(value)
                            ? activeCatalogState.filters[facet].filter((entry) => entry !== value)
                            : [...activeCatalogState.filters[facet], value],
                        },
                      },
                      { resetPage: true },
                    )
                  }
                  onToggleStatus={(status) =>
                    updateContext(
                      {
                        filters: {
                          ...activeCatalogState.filters,
                          [status === "legal-only"
                            ? "legalOnly"
                            : status === "available-to-add"
                              ? "availableToAdd"
                              : "bookmarkedOnly"]:
                            !activeCatalogState.filters[
                              status === "legal-only"
                                ? "legalOnly"
                                : status === "available-to-add"
                                  ? "availableToAdd"
                                  : "bookmarkedOnly"
                            ],
                        },
                      },
                      { resetPage: true },
                    )
                  }
                  onFiltersChange={(filters) => updateContext({ filters }, { resetPage: true })}
                  facetGroups={facetGroups}
                  grouping={catalogGrouping}
                  sortKey={catalogSortKey}
                  sortDirection={catalogSortDirection}
                  onGroupingChange={setCatalogGrouping}
                  onSortKeyChange={(key) => {
                    setCatalogSortKey(key);
                    updateContext({}, { resetPage: true });
                  }}
                  onSortDirectionChange={setCatalogSortDirection}
                  groups={catalogGroups}
                  resultCount={sortedPool.length}
                  poolCount={pool.length}
                  visibleCount={visibleCount}
                  onLoadMore={() =>
                    updateContext({ visible: activeCatalogState.visible + PAGE_SIZE })
                  }
                  pageSize={PAGE_SIZE}
                  bookmarks={bookmarks}
                  deckCountFor={deckCountFor}
                  isBanned={(card) => isBannedInStandardConstructed(card)}
                  onAddCard={handleAddCard}
                  onToggleBookmark={toggleBookmark}
                  onViewDetails={(card) => {
                    setDetailCard(card);
                    setDetailOpen(true);
                  }}
                  filterOpen={filterOpen}
                  onFilterOpenChange={setFilterOpen}
                  viewOpen={viewOpen}
                  onViewOpenChange={setViewOpen}
                  onDragCardStart={(card) => setDragState({ source: "catalog", card })}
                  onDragEnd={clearDrag}
                  onCatalogDragOver={handleCatalogDragOver}
                  onCatalogDragLeave={() => setDragOverCatalog(false)}
                  onCatalogDrop={handleCatalogDrop}
                  dragOverCatalog={dragOverCatalog}
                />
              </div>
            </div>
          ) : null}

          {!deckOnly ? (
            <button
              type="button"
              aria-label={T.resizePanels}
              className="db-resizer db-desktop-only"
              onPointerDown={(event) => {
                event.preventDefault();
                const startX = event.clientX;
                const startWidth = catalogPaneWidth;
                const onMove = (moveEvent: PointerEvent) => {
                  const delta = ((moveEvent.clientX - startX) / window.innerWidth) * 100;
                  setCatalogPaneWidth(Math.min(72, Math.max(28, startWidth + delta)));
                };
                const onUp = () => {
                  window.removeEventListener("pointermove", onMove);
                  window.removeEventListener("pointerup", onUp);
                };
                window.addEventListener("pointermove", onMove);
                window.addEventListener("pointerup", onUp);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  setCatalogPaneWidth((width) => Math.max(28, width - 2));
                } else if (event.key === "ArrowRight") {
                  event.preventDefault();
                  setCatalogPaneWidth((width) => Math.min(72, width + 2));
                } else if (event.key === "Home") {
                  event.preventDefault();
                  setCatalogPaneWidth(28);
                } else if (event.key === "End") {
                  event.preventDefault();
                  setCatalogPaneWidth(72);
                }
              }}
            >
              <span className="sr-only">{T.resizePanels}</span>
            </button>
          ) : null}

          <div
            data-testid="desktop-deck-workspace-panel"
            className="db-desktop-only db-workspace-sticky min-w-0 self-start bg-secondary/[0.06]"
          >
            <DeckWorkspace {...workspaceProps} />
          </div>
        </section>
      </main>

      {/* Mobile bottom-sheet deck drawer */}
      <div
        className="db-drawer db-mobile-only"
        data-open={drawerOpen}
        role="dialog"
        aria-label={T.deckWorkspace}
      >
        <div className="flex items-center gap-2 border-b border-border/60 px-4 pb-3 pt-2">
          <button
            type="button"
            data-testid="mobile-deck-drawer-toggle"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((current) => !current)}
            className="min-w-0 flex-1 touch-none text-left"
          >
            <span className="block truncate text-sm font-semibold">{displayName}</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {mobileSummary(T.cardsCount(totalCardCount), ready ? T.readyToPlay : statusText)}
            </span>
          </button>
          <button
            type="button"
            aria-label={T.save}
            onClick={handleSave}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
              <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
              <path d="M7 3v4a1 1 0 0 0 1 1h7" />
            </svg>
          </button>
          <button
            type="button"
            data-testid="mobile-deck-overview-toggle"
            aria-label={T.toggleDeckOverview}
            onClick={() => {
              setDrawerOpen(true);
              setMobileNameOpen((current) => !current);
            }}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 3h6v6" />
              <path d="m21 3-7 7" />
              <path d="m3 21 7-7" />
              <path d="M9 21H3v-6" />
            </svg>
          </button>
        </div>
        {drawerOpen ? (
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            data-testid="mobile-deck-workspace-panel"
          >
            <DeckWorkspace
              {...workspaceProps}
              mobile
              onMobileNameToggle={() => setMobileNameOpen((current) => !current)}
              mobileNameOpen={mobileNameOpen}
            />
          </div>
        ) : null}
      </div>

      <DeckImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
        onNotice={(message) => pushToast(message, "success")}
      />

      <GuideDialog
        open={guideOpen}
        deckName={displayName}
        initialHtml={guideHtml}
        onClose={() => setGuideOpen(false)}
        onSave={setGuideHtml}
      />

      <CardDetailDialog card={detailCard} open={detailOpen} onClose={() => setDetailOpen(false)} />

      <DiscardDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onDiscard={discardDraft}
        hasSavedDeck={Boolean(linkedSavedDeckId)}
      />

      <ArtPicker
        open={artPicker !== null}
        entry={artPicker?.entry ?? null}
        card={
          artPicker ? (resolveCard(artPicker.entry.cardCode, artPicker.entry.name) ?? null) : null
        }
        onClose={() => setArtPicker(null)}
        onSelect={(print) => {
          if (!artPicker) return;
          selectPrint(artPicker.section, artPicker.entry, print);
          setArtPicker(null);
        }}
      />

      <AccountDialog
        open={accountOpen}
        onClose={closeAccount}
        reason={accountReason}
        initialMode={accountMode}
        guestName={signedIn ? identityApi.identity.name : undefined}
        signedInKind={identityApi.identity.kind}
        onGuestLogin={(guestName) => {
          identityApi.signOut();
          identityApi.setDisplayName(guestName);
          setAccountOpen(false);
          setAccountReason(null);
          pendingAuthRef.current = null;
          writePendingAuthAction(null);
          pushToast(`Signed in as ${guestName}`, "success");
        }}
        onPasswordLogin={async (username, password) => {
          const next = await identityApi.signIn(username, password);
          setAccountOpen(false);
          setAccountReason(null);
          pushToast(`Signed in as ${next.name}`, "success");
        }}
        onRegisterAccount={async (username, password) => {
          const next = await identityApi.register(username, password);
          setAccountOpen(false);
          setAccountReason(null);
          pushToast(`Signed in as ${next.name}`, "success");
        }}
        onSignOut={() => {
          identityApi.signOut();
          pushToast("Signed out", "info");
        }}
      />

      <ToastStack toasts={toasts} />
    </div>
  );
}
