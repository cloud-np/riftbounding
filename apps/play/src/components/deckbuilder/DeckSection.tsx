"use client";

import type { Card, DeckSectionKey, DeckSections, ParsedDeckEntry } from "@rift/cards";

import type { DeckListGroupKey, DeckListSortKey, SortDirection } from "./types";
import { DeckRow } from "./DeckRow";
import { groupDeckEntries } from "./catalog";
import { SECTION_ADD_LABELS, T } from "./strings";
import { CountBadge } from "./ui";

export interface DeckSectionProps {
  section: DeckSectionKey;
  label: string;
  entries: ParsedDeckEntry[];
  total: number;
  required: number;
  /** Sideboard is a cap, not an exact requirement. */
  cap?: boolean;
  mobile?: boolean;
  cardFor: (entry: ParsedDeckEntry) => Card | undefined;
  canIncrement: (entry: ParsedDeckEntry) => boolean;
  moveTarget?: "Main Deck" | "Sideboard";
  onIncrement: (entry: ParsedDeckEntry) => void;
  onDecrement: (entry: ParsedDeckEntry) => void;
  onMove: (entry: ParsedDeckEntry) => void;
  onViewDetails: (entry: ParsedDeckEntry) => void;
  onChooseArt?: (entry: ParsedDeckEntry) => void;
  onEmptyAction: () => void;
  onDragEntryStart: (entry: ParsedDeckEntry) => void;
  onDragEnd: () => void;
  onDragOver?: (event: React.DragEvent) => void;
  onDrop?: (event: React.DragEvent) => void;
  isDragOver?: boolean;
  groupKey?: DeckListGroupKey;
  sortKey?: DeckListSortKey;
  sortDirection?: SortDirection;
  onGroupKeyChange?: (key: DeckListGroupKey) => void;
  onSortKeyChange?: (key: DeckListSortKey) => void;
  onSortDirectionChange?: (direction: SortDirection) => void;
  /** Legend section: entries after the starting legend. */
  additionalEntries?: ParsedDeckEntry[];
  additionalLabel?: string;
  additionalCap?: number;
}

const GROUP_OPTIONS: { value: DeckListGroupKey; label: string }[] = [
  { value: "section", label: T.noGrouping },
  { value: "type", label: T.groupByType },
  { value: "energy", label: T.groupByEnergy },
  { value: "power", label: T.groupByPower },
  { value: "domain", label: T.groupByDomain },
];

const SORT_OPTIONS: { value: DeckListSortKey; label: string }[] = [
  { value: "name", label: T.name },
  { value: "type", label: T.type },
  { value: "energy", label: T.energy },
  { value: "power", label: T.power },
  { value: "domain", label: T.domain },
  { value: "copies", label: T.copies },
];

function countText(section: DeckSectionKey, total: number): string {
  switch (section) {
    case "legend":
      return T.countLegend(total);
    case "champion":
      return T.countChampion(total);
    case "mainDeck":
      return T.countMainDeck(total);
    case "battlefields":
      return T.countBattlefields(total);
    case "runes":
      return T.countRunes(total);
    case "sideboard":
      return T.countSideboard(total);
    default:
      return `${total}`;
  }
}

export function DeckSection({
  section,
  label,
  entries,
  total,
  required,
  cap = false,
  mobile = false,
  cardFor,
  canIncrement,
  moveTarget,
  onIncrement,
  onDecrement,
  onMove,
  onViewDetails,
  onChooseArt,
  onEmptyAction,
  onDragEntryStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragOver = false,
  groupKey,
  sortKey,
  sortDirection,
  onGroupKeyChange,
  onSortKeyChange,
  onSortDirectionChange,
  additionalEntries = [],
  additionalLabel,
  additionalCap,
}: DeckSectionProps) {
  const complete = total === required;
  const showControls = section === "mainDeck" || section === "sideboard";
  const displayGroups = showControls
    ? groupDeckEntries(entries, groupKey ?? "section", sortKey ?? "name", sortDirection ?? "asc")
    : [{ key: "all", label: "", entries }];
  const rows = (list: ParsedDeckEntry[], listSection: DeckSectionKey = section) =>
    list.map((entry) => (
      <DeckRow
        key={entry.cardCode ?? entry.name}
        entry={entry}
        card={cardFor(entry)}
        section={listSection}
        canIncrement={canIncrement(entry)}
        moveTarget={
          listSection === "mainDeck" || listSection === "sideboard" ? moveTarget : undefined
        }
        onIncrement={() => onIncrement(entry)}
        onDecrement={() => onDecrement(entry)}
        onMove={() => onMove(entry)}
        onViewDetails={() => onViewDetails(entry)}
        onChooseArt={onChooseArt ? () => onChooseArt(entry) : undefined}
        onDragStart={onDragEntryStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
        isDragOver={isDragOver}
      />
    ));

  return (
    <section
      data-deck-workspace-section={section}
      data-deckbuilder-drop-target={section}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`relative grid self-start gap-2 transition-[background-color,box-shadow] ${
        isDragOver ? "db-drag-target" : ""
      }`}
    >
      <div
        data-deck-section-sticky-header="true"
        className={`sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/95 pb-2 pt-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/78 ${
          section === "legend" && !complete ? "border-amber-500/32" : "border-border/60"
        }`}
      >
        <h3 className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </h3>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
          {showControls && !mobile ? (
            <>
              <select
                aria-label={T.groupMainDeckList(label)}
                value={groupKey ?? "section"}
                onChange={(event) => onGroupKeyChange?.(event.target.value as DeckListGroupKey)}
                className="h-6 max-w-[7.5rem] rounded border border-border/70 bg-background/80 px-1 text-[10px] font-medium text-foreground/80 outline-none"
              >
                {GROUP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                aria-label={T.sortSectionList(label)}
                value={sortKey ?? "name"}
                onChange={(event) => onSortKeyChange?.(event.target.value as DeckListSortKey)}
                className="h-6 max-w-[6rem] rounded border border-border/70 bg-background/80 px-1 text-[10px] font-medium text-foreground/80 outline-none"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label={
                  sortDirection === "desc"
                    ? T.sortSectionDescending(label)
                    : T.sortSectionAscending(label)
                }
                onClick={() => onSortDirectionChange?.(sortDirection === "desc" ? "asc" : "desc")}
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-border/70 bg-background/80 text-foreground/70 hover:bg-secondary hover:text-foreground"
              >
                <span aria-hidden="true" className="text-[13px] leading-none">
                  {sortDirection === "desc" ? "↓" : "↑"}
                </span>
              </button>
            </>
          ) : null}
          {showControls && mobile ? (
            <>
              <select
                aria-label={T.groupMainDeckList(label)}
                value={groupKey ?? "section"}
                onChange={(event) => onGroupKeyChange?.(event.target.value as DeckListGroupKey)}
                className="h-6 max-w-[6.5rem] rounded border border-border/70 bg-background/80 px-1 text-[10px] font-medium text-foreground/80 outline-none"
              >
                {GROUP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                aria-label={T.sortSectionList(label)}
                value={sortKey ?? "name"}
                onChange={(event) => onSortKeyChange?.(event.target.value as DeckListSortKey)}
                className="h-6 max-w-[5.5rem] rounded border border-border/70 bg-background/80 px-1 text-[10px] font-medium text-foreground/80 outline-none"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label={
                  sortDirection === "desc"
                    ? T.sortSectionDescending(label)
                    : T.sortSectionAscending(label)
                }
                onClick={() => onSortDirectionChange?.(sortDirection === "desc" ? "asc" : "desc")}
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-border/70 bg-background/80 text-foreground/70 hover:bg-secondary hover:text-foreground"
              >
                <span aria-hidden="true" className="text-[13px] leading-none">
                  {sortDirection === "desc" ? "↓" : "↑"}
                </span>
              </button>
            </>
          ) : null}
          <CountBadge
            complete={complete}
            amber
            compact={mobile}
            srLabel={`${label} count ${countText(section, total)}`}
          >
            {`${total}/${required}`}
          </CountBadge>
        </div>
      </div>

      <div
        className={
          mobile
            ? "grid gap-1.5"
            : "grid items-start justify-start gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))]"
        }
      >
        {entries.length === 0 ? (
          <button
            type="button"
            data-deck-empty-section-action={section}
            onClick={onEmptyAction}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border/70 bg-background/45 px-3 text-sm font-medium text-foreground/72 transition-colors hover:border-foreground/25 hover:bg-secondary/60"
          >
            <BuilderPlus />
            {SECTION_ADD_LABELS[section]}
          </button>
        ) : (
          displayGroups.flatMap((group) => [
            ...(group.label
              ? [
                  <div
                    key={`group-${group.key}`}
                    className="col-span-full flex items-center gap-2 border-b border-border/40 pb-1 pt-1"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      {group.entries.reduce((sum, entry) => sum + entry.count, 0)}
                    </span>
                  </div>,
                ]
              : []),
            ...rows(group.entries),
          ])
        )}
      </div>

      {additionalEntries.length > 0 ? (
        <div className="mt-2 grid gap-2">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-1.5">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {additionalLabel ?? T.additionalLegends}
            </h4>
            <span className="text-[11px] text-muted-foreground">
              {additionalEntries.reduce((sum, entry) => sum + entry.count, 0)}/{additionalCap ?? 3}
            </span>
          </div>
          <div
            className={
              mobile
                ? "grid gap-1.5"
                : "grid items-start justify-start gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))]"
            }
          >
            {rows(additionalEntries)}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function BuilderPlus() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
