"use client";

import { BuilderIcon } from "./BuilderIcon";
import { T } from "./strings";
import type { CatalogGrouping, CatalogSortKey, SortDirection } from "./types";

const SORT_OPTIONS: { key: CatalogSortKey; label: string }[] = [
  { key: "name", label: T.name },
  { key: "energy", label: T.energy },
  { key: "power", label: T.power },
  { key: "might", label: T.might },
  { key: "type", label: T.type },
  { key: "domain", label: T.domain },
  { key: "rarity", label: T.rarity },
  { key: "set", label: T.set },
];

export function CatalogViewPopover({
  grouping,
  sortKey,
  sortDirection,
  onGroupingChange,
  onSortKeyChange,
  onSortDirectionChange,
  onClose,
}: {
  grouping: CatalogGrouping;
  sortKey: CatalogSortKey;
  sortDirection: SortDirection;
  onGroupingChange: (grouping: CatalogGrouping) => void;
  onSortKeyChange: (key: CatalogSortKey) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
  onClose: () => void;
}) {
  return (
    <div className="w-64">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
        <h2 className="text-sm font-semibold">{T.view}</h2>
        <button
          type="button"
          aria-label="Close sort options"
          onClick={onClose}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <BuilderIcon name="close" className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="px-4 py-3">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {T.groupBy}
        </p>
        <select
          aria-label={T.groupCards}
          value={grouping}
          onChange={(event) => onGroupingChange(event.target.value as CatalogGrouping)}
          className="h-8 w-full rounded-md border border-border/70 bg-background px-2 text-xs text-foreground outline-none focus:border-foreground/30"
        >
          <option value="none">{T.noGrouping}</option>
          <option value="domain">{T.domain}</option>
          <option value="type">{T.type}</option>
        </select>
      </div>
      <div className="border-t border-border/60 px-4 py-2">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {T.sortBy}
        </p>
        <div role="radiogroup" aria-label={T.sortBy} className="grid gap-0.5">
          {SORT_OPTIONS.map((option) => {
            const selected = option.key === sortKey;
            return (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onSortKeyChange(option.key)}
                className={`flex h-7 items-center justify-between rounded px-2 text-left text-xs transition-colors ${
                  selected
                    ? "bg-secondary font-semibold text-foreground"
                    : "text-foreground/78 hover:bg-secondary/70"
                }`}
              >
                <span>{option.label}</span>
                {selected ? <BuilderIcon name="check" className="h-3.5 w-3.5" /> : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="border-t border-border/60 px-4 py-2">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {T.direction}
        </p>
        <div className="grid grid-cols-2 gap-1 rounded-md border border-border/60 bg-background p-0.5">
          {(["asc", "desc"] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              aria-pressed={sortDirection === direction}
              onClick={() => onSortDirectionChange(direction)}
              className={`inline-flex h-7 items-center justify-center rounded text-xs font-semibold transition-colors ${
                sortDirection === direction
                  ? "bg-foreground text-background shadow-sm"
                  : "text-foreground/70 hover:bg-secondary"
              }`}
            >
              {direction === "asc" ? T.asc : T.desc}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
