import type { DeckSectionKey, ParsedDeckEntry } from "@rift/cards";

export type WorkspaceTab = "list" | "fullArt" | "stats";
export type CatalogGrouping = "none" | "domain" | "type";
export type CatalogSortKey =
  "name" | "energy" | "power" | "might" | "type" | "domain" | "rarity" | "set";
export type SortDirection = "asc" | "desc";
export type DeckListGroupKey = "section" | "type" | "energy" | "power" | "domain";
export type DeckListSortKey = "name" | "type" | "energy" | "power" | "domain" | "copies";
export type ArtCopiesLayout = "stacked" | "separate";
export type FullArtSize = "xxsmall" | "xsmall" | "small" | "medium" | "large" | "xlarge";

export interface DeckbuilderListPreferences {
  /** Catalog group (No Grouping / Domain / Type). */
  catalogGrouping: CatalogGrouping;
  copiesLayout: ArtCopiesLayout;
  fullArtSize: FullArtSize;
  /** Deck-list group (section = No Grouping). */
  deckListGroupKey: DeckListGroupKey;
  deckListSortDirection: SortDirection;
  deckListSortKey: DeckListSortKey;
  deckWorkspaceTab: Exclude<WorkspaceTab, "stats">;
}

/**
 * The original's single localStorage draft (`riftatlas_deckbuilder_draft_v1`,
 * version 5). Field order and optional `startingLegendVacant` are preserved.
 */
export interface DeckbuilderDraftV5 {
  version: 5;
  name: string;
  guideHtml: string;
  linkedSavedDeckId: string | null;
  deckSections: Record<DeckSectionKey, ParsedDeckEntry[]>;
  bookmarkScopeId: string;
  selectedSection: DeckSectionKey;
  lastSavedSignature: string | null;
  lastSavedStatus: "ready" | "incomplete" | null;
  lastSavedAt: number | null;
  hasUnsavedChanges: boolean;
  startingLegendVacant?: true;
}

export interface SavedDeckMeta {
  id: string;
  name: string;
  status: "ready" | "incomplete";
  legalityVersion: string;
  revision: number;
  updatedAt: number;
  publishedDeckId?: string | null;
}

export type ToastTone = "info" | "success" | "error";

export interface BuilderToast {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface CatalogFilters {
  domain: string[];
  type: string[];
  rarity: string[];
  energy: string[];
  power: string[];
  might: string[];
  set: string[];
  keywords: string[];
  tags: string[];
  abilities: string[];
  legalOnly: boolean;
  availableToAdd: boolean;
  bookmarkedOnly: boolean;
}

export const EMPTY_FILTERS: CatalogFilters = {
  domain: [],
  type: [],
  rarity: [],
  energy: [],
  power: [],
  might: [],
  set: [],
  keywords: [],
  tags: [],
  abilities: [],
  legalOnly: false,
  availableToAdd: false,
  bookmarkedOnly: false,
};

export interface PendingAuthAction {
  version: 1;
  kind: "save_deck" | "publish_deck";
  options?: Record<string, unknown>;
  deckSource?: string;
  suggestedName?: string;
}
