"use client";

import type { Card, DeckSectionKey, DeckSections, ParsedDeckEntry } from "@rift/cards";

import { CardArt } from "./CardArt";
import { BuilderIcon } from "./BuilderIcon";
import { groupDeckEntries, printVariants } from "./catalog";
import { SECTION_LABELS, T } from "./strings";
import { CountBadge } from "./ui";
import type {
  ArtCopiesLayout,
  DeckListGroupKey,
  DeckListSortKey,
  FullArtSize,
  SortDirection,
} from "./types";

const SIZE_TO_COLUMNS: Record<FullArtSize, number> = {
  xxsmall: 8,
  xsmall: 7,
  small: 5,
  medium: 4,
  large: 3,
  xlarge: 2,
};

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

export interface FullArtViewProps {
  sections: DeckSections;
  cardFor: (entry: ParsedDeckEntry) => Card | undefined;
  copiesLayout: ArtCopiesLayout;
  fullArtSize: FullArtSize;
  groupKey: DeckListGroupKey;
  sortKey: DeckListSortKey;
  sortDirection: SortDirection;
  onGroupKeyChange: (key: DeckListGroupKey) => void;
  onSortKeyChange: (key: DeckListSortKey) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
  onIncrement: (section: DeckSectionKey, entry: ParsedDeckEntry) => void;
  onDecrement: (section: DeckSectionKey, entry: ParsedDeckEntry) => void;
  onViewDetails: (entry: ParsedDeckEntry) => void;
  onChooseArt: (section: DeckSectionKey, entry: ParsedDeckEntry) => void;
  onEmptySection: (section: DeckSectionKey) => void;
}

function ArtTile({
  entry,
  card,
  section,
  copies,
  compact = false,
  onIncrement,
  onDecrement,
  onViewDetails,
  onChooseArt,
}: {
  entry: ParsedDeckEntry;
  card: Card | undefined;
  section: DeckSectionKey;
  copies: number;
  compact?: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onViewDetails: () => void;
  onChooseArt: () => void;
}) {
  const canChooseArt =
    card && printVariants(card).length > 1 && (section === "legend" || section === "champion");
  return (
    <div
      data-deck-full-art-card={entry.cardCode ?? entry.name}
      className={`group/art relative min-w-0 overflow-hidden rounded-md border border-black/60 bg-[#101724] shadow-[0_4px_14px_rgba(9,10,19,0.28)] ${
        compact ? "w-full max-w-[7.5rem]" : ""
      }`}
    >
      <button
        type="button"
        aria-label={canChooseArt ? `Choose art for ${entry.name}` : T.viewDetailsFor(entry.name)}
        onClick={canChooseArt ? onChooseArt : onViewDetails}
        className="relative block aspect-[488/680] w-full overflow-hidden"
      >
        {card ? (
          <CardArt
            card={card}
            slot="small"
            sizes="(max-width: 1023px) 120px, 140px"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-slate-800 px-1 text-center text-[9px] text-white">
            {entry.name}
          </span>
        )}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(5,8,16,0.88))] px-1.5 pb-1 pt-5 text-left">
          <span className="block truncate text-[9px] font-semibold text-white/92">
            {entry.name}
          </span>
        </span>
        {card && card.energyCost > 0 ? (
          <span className="absolute left-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-[0.22rem] bg-white px-1 text-[9px] font-bold text-black">
            {card.energyCost}
          </span>
        ) : null}
        {copies > 0 ? (
          <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-[0.22rem] bg-[rgba(7,10,18,0.78)] px-1 text-[9px] font-semibold text-white/90">
            x{copies}
          </span>
        ) : null}
      </button>
      <div className="absolute inset-x-0 bottom-0 flex translate-y-2 items-center justify-center gap-1 bg-[rgba(5,8,16,0.78)] px-1 py-1 opacity-0 transition-all group-hover/art:translate-y-0 group-hover/art:opacity-100 group-focus-within/art:translate-y-0 group-focus-within/art:opacity-100">
        <button
          type="button"
          aria-label={T.decreaseQuantity(entry.name, SECTION_LABELS[section])}
          onClick={onDecrement}
          className="inline-flex h-5 w-5 items-center justify-center rounded border border-white/20 text-white/85 hover:bg-white/10"
        >
          <BuilderIcon name="minus" className="h-3 w-3" />
        </button>
        <button
          type="button"
          aria-label={T.increaseQuantity(entry.name, SECTION_LABELS[section])}
          onClick={onIncrement}
          className="inline-flex h-5 w-5 items-center justify-center rounded border border-white/20 text-white/85 hover:bg-white/10"
        >
          <BuilderIcon name="plus" className="h-3 w-3" />
        </button>
        <button
          type="button"
          aria-label={T.viewDetailsFor(entry.name)}
          onClick={onViewDetails}
          className="inline-flex h-5 w-5 items-center justify-center rounded border border-white/20 text-white/85 hover:bg-white/10"
        >
          <BuilderIcon name="expand" className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function SectionHead({
  label,
  total,
  required,
  compact,
  controls,
}: {
  label: string;
  total: number;
  required: number;
  compact?: boolean;
  controls?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </h3>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
        {controls}
        <CountBadge
          complete={total === required}
          amber
          compact={compact}
          srLabel={`${label} count ${total}/${required}`}
        >
          {`${total}/${required}`}
        </CountBadge>
      </div>
    </div>
  );
}

export function FullArtView({
  sections,
  cardFor,
  copiesLayout,
  fullArtSize,
  groupKey,
  sortKey,
  sortDirection,
  onGroupKeyChange,
  onSortKeyChange,
  onSortDirectionChange,
  onIncrement,
  onDecrement,
  onViewDetails,
  onChooseArt,
  onEmptySection,
}: FullArtViewProps) {
  const columns = SIZE_TO_COLUMNS[fullArtSize];

  const tilesFor = (section: DeckSectionKey, entries: ParsedDeckEntry[], compact = false) =>
    entries.flatMap((entry) => {
      const card = cardFor(entry);
      const copies = copiesLayout === "separate" ? entry.count : 1;
      return Array.from({ length: copies }, (_, index) => (
        <ArtTile
          key={`${entry.cardCode ?? entry.name}-${index}`}
          entry={entry}
          card={card}
          section={section}
          copies={copiesLayout === "separate" ? 1 : entry.count}
          compact={compact}
          onIncrement={() => onIncrement(section, entry)}
          onDecrement={() => onDecrement(section, entry)}
          onViewDetails={() => onViewDetails(entry)}
          onChooseArt={() => onChooseArt(section, entry)}
        />
      ));
    });

  const empty = (section: DeckSectionKey) => (
    <button
      type="button"
      onClick={() => onEmptySection(section)}
      className="col-span-full flex min-h-20 items-center justify-center rounded-md border border-dashed border-border/70 bg-background/45 px-3 text-xs text-foreground/65 hover:border-foreground/25 hover:bg-secondary/50"
    >
      {T.addCardsFirst}
    </button>
  );

  const listControls = (label: string) => (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <select
        aria-label={T.groupMainDeckList(label)}
        value={groupKey}
        onChange={(event) => onGroupKeyChange(event.target.value as DeckListGroupKey)}
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
        value={sortKey}
        onChange={(event) => onSortKeyChange(event.target.value as DeckListSortKey)}
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
          sortDirection === "desc" ? T.sortSectionDescending(label) : T.sortSectionAscending(label)
        }
        onClick={() => onSortDirectionChange(sortDirection === "desc" ? "asc" : "desc")}
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-border/70 bg-background/80 text-foreground/70 hover:bg-secondary hover:text-foreground"
      >
        <span aria-hidden="true" className="text-[13px] leading-none">
          {sortDirection === "desc" ? "↓" : "↑"}
        </span>
      </button>
    </div>
  );

  const groupedTiles = (section: "mainDeck" | "sideboard") => {
    const groups = groupDeckEntries(sections[section], groupKey, sortKey, sortDirection);
    return groups.flatMap((group) => [
      ...(group.label
        ? [
            <div
              key={`fa-group-${section}-${group.key}`}
              className="col-span-full flex items-center gap-2 border-b border-border/40 pb-0.5 pt-1"
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
      ...tilesFor(section, group.entries),
    ]);
  };

  const sectionGrid = (section: DeckSectionKey, entries: ParsedDeckEntry[]) => (
    <div
      className="db-fullart-grid grid gap-1.5"
      style={{ ["--db-fullart-cols" as string]: String(Math.min(columns, 6)) }}
    >
      {entries.length === 0 ? empty(section) : tilesFor(section, entries)}
    </div>
  );

  return (
    <div className="grid gap-5">
      <section className="grid gap-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <SectionHead
              label={SECTION_LABELS.legend}
              total={Math.min(
                sections.legend.reduce((sum, entry) => sum + entry.count, 0),
                1,
              )}
              required={1}
            />
            <div className="flex justify-center">
              {sections.legend.length === 0
                ? empty("legend")
                : tilesFor("legend", sections.legend, true)}
            </div>
          </div>
          <div className="grid gap-2">
            <SectionHead
              label={SECTION_LABELS.champion}
              total={sections.champion.reduce((sum, entry) => sum + entry.count, 0)}
              required={1}
            />
            <div className="flex justify-center">
              {sections.champion.length === 0
                ? empty("champion")
                : tilesFor("champion", sections.champion, true)}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-2">
        <SectionHead
          label={SECTION_LABELS.mainDeck}
          total={sections.mainDeck.reduce((sum, entry) => sum + entry.count, 0)}
          required={39}
          controls={listControls(SECTION_LABELS.mainDeck)}
        />
        <div
          className="db-fullart-grid grid gap-1.5"
          style={{ ["--db-fullart-cols" as string]: String(columns) }}
        >
          {sections.mainDeck.length === 0 ? empty("mainDeck") : groupedTiles("mainDeck")}
        </div>
      </section>

      <section className="grid gap-2">
        <SectionHead
          label={SECTION_LABELS.battlefields}
          total={sections.battlefields.reduce((sum, entry) => sum + entry.count, 0)}
          required={3}
        />
        {sectionGrid("battlefields", sections.battlefields)}
      </section>

      <section className="grid gap-2">
        <SectionHead
          label={SECTION_LABELS.sideboard}
          total={sections.sideboard.reduce((sum, entry) => sum + entry.count, 0)}
          required={10}
          controls={listControls(SECTION_LABELS.sideboard)}
        />
        <div
          className="db-fullart-grid grid gap-1.5"
          style={{ ["--db-fullart-cols" as string]: String(columns) }}
        >
          {sections.sideboard.length === 0 ? empty("sideboard") : groupedTiles("sideboard")}
        </div>
      </section>

      <section className="grid gap-2">
        <SectionHead
          label={SECTION_LABELS.runes}
          total={sections.runes.reduce((sum, entry) => sum + entry.count, 0)}
          required={12}
        />
        {sectionGrid("runes", sections.runes)}
      </section>
    </div>
  );
}
