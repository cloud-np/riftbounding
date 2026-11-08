"use client";

import { Fragment } from "react";
import type { Card, DeckSectionKey, DeckSections, ParsedDeckEntry } from "@rift/cards";

import { BuilderIcon } from "./BuilderIcon";
import { CardTile } from "./CardTile";
import { CatalogFilterPopover } from "./CatalogFilterPopover";
import { CatalogViewPopover } from "./CatalogViewPopover";
import type { CatalogGroup, FacetGroup, FilterFacetId, StatusFacetId } from "./catalog";
import { SECTION_GATE_MESSAGES, SECTION_LABELS, SECTION_ORDER, T } from "./strings";
import type { CatalogFilters, CatalogGrouping, CatalogSortKey, SortDirection } from "./types";
import { AnchorPopover } from "./ui";

export interface CatalogPanelProps {
  section: DeckSectionKey;
  onSelectSection: (section: DeckSectionKey) => void;
  legend: ParsedDeckEntry | undefined;
  sections: DeckSections;
  search: string;
  onSearchChange: (value: string) => void;
  filters: CatalogFilters;
  onToggleFilter: (facet: FilterFacetId, value: string) => void;
  onToggleStatus: (status: StatusFacetId) => void;
  onFiltersChange: (filters: CatalogFilters) => void;
  facetGroups: FacetGroup[];
  grouping: CatalogGrouping;
  sortKey: CatalogSortKey;
  sortDirection: SortDirection;
  onGroupingChange: (grouping: CatalogGrouping) => void;
  onSortKeyChange: (key: CatalogSortKey) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
  groups: CatalogGroup[];
  resultCount: number;
  poolCount: number;
  visibleCount: number;
  onLoadMore: () => void;
  pageSize: number;
  bookmarks: ReadonlySet<string>;
  deckCountFor: (card: Card) => number;
  isBanned: (card: Card) => boolean;
  onAddCard: (card: Card) => void;
  onToggleBookmark: (card: Card) => void;
  onViewDetails: (card: Card) => void;
  filterOpen: boolean;
  onFilterOpenChange: (open: boolean) => void;
  viewOpen: boolean;
  onViewOpenChange: (open: boolean) => void;
  onDragCardStart?: (card: Card) => void;
  onDragEnd?: () => void;
  onCatalogDragOver?: (event: React.DragEvent) => void;
  onCatalogDragLeave?: (event: React.DragEvent) => void;
  onCatalogDrop?: (event: React.DragEvent) => void;
  dragOverCatalog?: boolean;
}

function summaryText(
  section: DeckSectionKey,
  resultCount: number,
  poolCount: number,
  gated: boolean,
): string {
  if (gated || poolCount === 0) return T.cardsOfForSection(0, 0, SECTION_LABELS[section]);
  if (resultCount === 0) return T.cardsForSection(0, SECTION_LABELS[section]);
  return T.cardsOfForSection(resultCount, poolCount, SECTION_LABELS[section]);
}

export function CatalogPanel({
  section,
  onSelectSection,
  legend,
  sections,
  search,
  onSearchChange,
  filters,
  onToggleFilter,
  onToggleStatus,
  onFiltersChange,
  facetGroups,
  grouping,
  sortKey,
  sortDirection,
  onGroupingChange,
  onSortKeyChange,
  onSortDirectionChange,
  groups,
  resultCount,
  poolCount,
  visibleCount,
  onLoadMore,
  pageSize,
  bookmarks,
  deckCountFor,
  isBanned,
  onAddCard,
  onToggleBookmark,
  onViewDetails,
  filterOpen,
  onFilterOpenChange,
  viewOpen,
  onViewOpenChange,
  onDragCardStart,
  onDragEnd,
  onCatalogDragOver,
  onCatalogDragLeave,
  onCatalogDrop,
  dragOverCatalog = false,
}: CatalogPanelProps) {
  void sections;
  const gated = section !== "legend" && section !== "battlefields" && !legend;
  const gateMessage = gated ? SECTION_GATE_MESSAGES[section] : null;
  const activeFilterCount =
    filters.domain.length +
    filters.type.length +
    filters.rarity.length +
    filters.energy.length +
    filters.power.length +
    filters.might.length +
    filters.set.length +
    filters.keywords.length +
    filters.tags.length +
    filters.abilities.length +
    (filters.legalOnly ? 1 : 0) +
    (filters.availableToAdd ? 1 : 0) +
    (filters.bookmarkedOnly ? 1 : 0);
  const shownCount = groups.reduce((sum, group) => sum + group.cards.length, 0);
  const summary = summaryText(section, resultCount, poolCount, gated);

  const emptyMessage =
    gated || poolCount === 0
      ? null
      : filters.bookmarkedOnly
        ? T.noBookmarkedMatch
        : filters.legalOnly
          ? T.everyMatchingBanned
          : filters.type.length ||
              filters.rarity.length ||
              filters.energy.length ||
              filters.power.length ||
              filters.might.length ||
              filters.set.length ||
              filters.keywords.length ||
              filters.tags.length ||
              filters.abilities.length ||
              filters.domain.length ||
              filters.availableToAdd
            ? T.noCardsMatchFilters
            : T.noCardsSearch;

  return (
    <div
      className={`flex min-h-0 flex-col ${dragOverCatalog ? "db-drag-target" : ""}`}
      data-testid="deckbuilder-catalog"
      data-deck-workspace-catalog="true"
      data-catalog-active-tab={section}
      onDragOver={onCatalogDragOver}
      onDragLeave={onCatalogDragLeave}
      onDrop={onCatalogDrop}
    >
      <div className="db-catalog-header bg-background/90 px-2 py-0.5 shadow-[0_14px_26px_-27px_rgba(0,0,0,0.55)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/78">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <nav
              id="deckbuilder-catalog-tabs"
              aria-label={T.catalogSections}
              data-catalog-tab-list="true"
              className="flex min-w-0 flex-1 gap-1 overflow-x-auto pr-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap"
            >
              {SECTION_ORDER.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={key === section}
                  aria-label={SECTION_LABELS[key]}
                  data-catalog-tab={key}
                  onClick={() => onSelectSection(key)}
                  className="inline-flex h-7 shrink-0 items-center rounded-md border border-border/70 bg-background/95 px-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 aria-pressed:border-transparent aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:shadow-sm"
                >
                  <span>{SECTION_LABELS[key]}</span>
                </button>
              ))}
            </nav>
            <p
              data-testid="deckbuilder-catalog-summary"
              role="status"
              aria-live="polite"
              className="shrink-0 text-xs text-muted-foreground"
            >
              <span className="db-summary-mobile">
                {gated ? "0/0" : `${resultCount}/${poolCount}`}
              </span>
              <span className="db-summary-desktop">{summary}</span>
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <BuilderIcon
                  name="search"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  data-testid="deckbuilder-catalog-search"
                  aria-label={T.searchSectionCards(SECTION_LABELS[section])}
                  placeholder={T.searchSectionCards(SECTION_LABELS[section])}
                  type="search"
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  className="h-7 w-full rounded-md border border-border/70 bg-background/95 pl-9 pr-10 text-sm text-foreground outline-none transition-colors focus:border-foreground/30 [&::-webkit-search-cancel-button]:appearance-none"
                />
              </div>
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={viewOpen}
                  aria-controls="deckbuilder-catalog-sort-menu"
                  aria-label={T.sortButtonAria(
                    sortKey === "name"
                      ? T.name
                      : sortKey === "energy"
                        ? T.energy
                        : sortKey === "power"
                          ? T.power
                          : sortKey === "might"
                            ? T.might
                            : sortKey === "type"
                              ? T.type
                              : sortKey === "domain"
                                ? T.domain
                                : sortKey === "rarity"
                                  ? T.rarity
                                  : T.set,
                    sortDirection === "asc" ? "ascending" : "descending",
                  )}
                  title={T.sortAndGroup}
                  data-testid="deckbuilder-catalog-view-options"
                  onClick={() => {
                    onViewOpenChange(!viewOpen);
                    onFilterOpenChange(false);
                  }}
                  className="inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border/70 bg-background/95 px-2 text-foreground/72 transition-colors hover:border-foreground/12 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                >
                  <BuilderIcon name="sort" className="h-4 w-4" />
                  <span className="db-summary-desktop text-xs">{T.view}</span>
                </button>
                <AnchorPopover
                  id="deckbuilder-catalog-sort-menu"
                  open={viewOpen}
                  onClose={() => onViewOpenChange(false)}
                  ariaLabel={T.sortCards}
                  className="w-64"
                >
                  <CatalogViewPopover
                    grouping={grouping}
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onGroupingChange={onGroupingChange}
                    onSortKeyChange={onSortKeyChange}
                    onSortDirectionChange={onSortDirectionChange}
                    onClose={() => onViewOpenChange(false)}
                  />
                </AnchorPopover>
              </div>
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={filterOpen}
                  aria-controls="deckbuilder-catalog-filter-menu"
                  aria-label={T.filterCards}
                  onClick={() => {
                    onFilterOpenChange(!filterOpen);
                    onViewOpenChange(false);
                  }}
                  className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border/70 bg-background/95 px-3 text-sm font-medium text-foreground/72 transition-colors hover:border-foreground/12 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                >
                  <BuilderIcon name="filter" className="db-summary-mobile h-4 w-4" />
                  <span className="db-summary-desktop">{T.filter}</span>
                  {activeFilterCount > 0 ? (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-bold text-background">
                      {activeFilterCount}
                    </span>
                  ) : null}
                  <BuilderIcon
                    name={filterOpen ? "chevron-up" : "chevron-down"}
                    className="db-summary-desktop h-3.5 w-3.5 text-muted-foreground"
                  />
                </button>
                <AnchorPopover
                  id="deckbuilder-catalog-filter-menu"
                  open={filterOpen}
                  onClose={() => onFilterOpenChange(false)}
                  labelledBy="deckbuilder-catalog-filter-title"
                  className="max-w-[calc(100vw-0.75rem)]"
                >
                  <CatalogFilterPopover
                    groups={facetGroups}
                    filters={filters}
                    onToggle={onToggleFilter}
                    onToggleStatus={onToggleStatus}
                    onChange={onFiltersChange}
                    onClose={() => onFilterOpenChange(false)}
                  />
                </AnchorPopover>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-0 pb-4 pt-4">
        {gateMessage ? (
          <div className="mb-4 rounded-md border border-dashed border-border/70 bg-background/45 px-4 py-4 text-sm text-foreground/80">
            {gateMessage}
          </div>
        ) : null}
        {!gateMessage && resultCount === 0 && emptyMessage ? (
          <div className="mb-4 rounded-md border border-dashed border-border/70 bg-background/45 px-4 py-4 text-sm text-foreground/80">
            {emptyMessage}
          </div>
        ) : null}
        {!gateMessage ? (
          <div
            data-testid="deckbuilder-catalog-grid"
            data-catalog-grid-layout="portrait"
            className="db-catalog-grid"
          >
            {groups.map((group) => (
              <Fragment key={group.key}>
                {group.label ? (
                  <div className="db-catalog-group flex items-center gap-2 border-b border-border/50 pb-1">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      {group.label}
                    </h2>
                    <span className="text-[11px] text-muted-foreground/70">
                      {group.cards.length}
                    </span>
                  </div>
                ) : null}
                {group.cards.map((card) => (
                  <CardTile
                    key={card.id}
                    card={card}
                    deckCount={deckCountFor(card)}
                    bookmarked={bookmarks.has(card.id)}
                    banned={isBanned(card)}
                    onAdd={onAddCard}
                    onToggleBookmark={onToggleBookmark}
                    onViewDetails={onViewDetails}
                    onDragStart={onDragCardStart}
                    onDragEnd={onDragEnd}
                  />
                ))}
              </Fragment>
            ))}
          </div>
        ) : null}
        {!gateMessage && resultCount > visibleCount ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              data-testid="deckbuilder-catalog-load-more"
              onClick={onLoadMore}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border/70 bg-background/95 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
              {T.loadMore(Math.min(pageSize, resultCount - visibleCount))}
            </button>
          </div>
        ) : null}
        {!gateMessage && shownCount > 0 ? (
          <p className="sr-only">{T.resultCount(shownCount, resultCount)}</p>
        ) : null}
      </div>
    </div>
  );
}
