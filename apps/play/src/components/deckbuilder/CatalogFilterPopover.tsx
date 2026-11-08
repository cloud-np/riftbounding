"use client";

import { useMemo, useState } from "react";

import { BuilderIcon } from "./BuilderIcon";
import { DomainIcon } from "./ui";
import type { FacetGroup, FacetOption, FilterFacetId, StatusFacetId } from "./catalog";
import { activeFilterCount, clearFilters } from "./catalog";
import { T } from "./strings";
import type { CatalogFilters } from "./types";

export interface CatalogFilterPopoverProps {
  groups: FacetGroup[];
  filters: CatalogFilters;
  onToggle: (facet: FilterFacetId, value: string) => void;
  onToggleStatus: (status: StatusFacetId) => void;
  onChange: (filters: CatalogFilters) => void;
  onClose: () => void;
}

function FacetChip({
  option,
  icon,
  onClick,
}: {
  option: FacetOption;
  icon?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={option.active}
      disabled={option.disabled}
      onClick={onClick}
      title={`${option.label}${option.count ? ` · ${option.count}` : ""}`}
      className={`inline-flex h-6 items-center gap-1 rounded border px-1.5 text-[11px] font-semibold transition-colors ${
        option.active
          ? "border-transparent bg-foreground text-background shadow-sm"
          : "border-border/70 bg-background/95 text-foreground/78 hover:border-foreground/20 hover:bg-secondary"
      } ${option.disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {icon && option.iconSrc ? <DomainIcon domain={option.label} className="size-3.5" /> : null}
      {icon ? null : <span>{option.label}</span>}
      {option.count > 0 && !icon ? (
        <span
          className={`tabular-nums ${option.active ? "text-background/70" : "text-muted-foreground"}`}
        >
          {option.count}
        </span>
      ) : null}
    </button>
  );
}

function SearchSelect({
  group,
  onToggle,
}: {
  group: FacetGroup;
  onToggle: (facet: FilterFacetId, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const active = group.options.filter((option) => option.active);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return group.options;
    return group.options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [group.options, query]);
  return (
    <div className="relative min-w-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 w-full items-center justify-between gap-1 rounded-md border border-border/70 bg-background/95 px-2 text-left text-[12px] font-medium text-foreground/80 transition-colors hover:border-foreground/18"
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <BuilderIcon name="search" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {active.length > 0
              ? active.length === 1
                ? active[0]?.label
                : `${active.length} selected`
              : `Any ${group.label}`}
          </span>
        </span>
        <BuilderIcon name="chevron-down" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+0.25rem)] z-20 w-full min-w-[13rem] overflow-hidden rounded-md border border-border/70 bg-popover shadow-[0_16px_40px_rgba(9,10,19,0.2)]">
          <div className="border-b border-border/60 p-1.5">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${group.label.toLowerCase()}...`}
              className="h-7 w-full rounded border border-border/70 bg-background px-2 text-xs outline-none focus:border-foreground/30"
            />
          </div>
          <div className="db-thin-scrollbar max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">No matches.</p>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => onToggle(group.id as FilterFacetId, option.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                    option.disabled
                      ? "cursor-not-allowed text-muted-foreground/50"
                      : "text-foreground/85 hover:bg-secondary"
                  }`}
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <span
                      className={`inline-flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border ${
                        option.active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background"
                      }`}
                    >
                      {option.active ? <BuilderIcon name="check" className="h-2.5 w-2.5" /> : null}
                    </span>
                    <span className="truncate">{option.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {option.count}
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="flex justify-end border-t border-border/60 px-2 py-1.5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] font-semibold text-foreground/70 hover:text-foreground"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CatalogFilterPopover({
  groups,
  filters,
  onToggle,
  onToggleStatus,
  onChange,
  onClose,
}: CatalogFilterPopoverProps) {
  const active = activeFilterCount(filters);
  const primary = groups.filter((group) => group.panelSection === "primary");
  const properties = groups.filter((group) => group.panelSection === "properties");
  const advanced = groups.filter((group) => group.panelSection === "advanced");
  const status = groups.filter((group) => group.panelSection === "status");

  const searchable = advanced.filter((group) => group.control === "searchable");
  const advancedChips = advanced.filter((group) => group.control === "chips");

  return (
    <div className="w-[min(43rem,calc(100vw-1.5rem))]">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <h2 id="deckbuilder-catalog-filter-title" className="text-sm font-semibold">
          Filter cards
        </h2>
        <div className="flex items-center gap-3">
          {active > 0 ? (
            <button
              type="button"
              onClick={() => onChange(clearFilters(filters))}
              className="text-[12px] font-semibold text-foreground/75 underline-offset-2 hover:text-foreground hover:underline"
            >
              {T.clearFilters}
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Close filters"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <BuilderIcon name="close" className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="db-thin-scrollbar max-h-[min(70vh,34rem)] overflow-y-auto px-4 py-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {primary.length > 0 ? (
            <div className="rounded-md border border-border/60 bg-secondary/25 px-3 py-2">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Card
              </p>
              <div className="grid gap-2">
                {primary.map((group) => (
                  <div key={group.id} role="group" aria-label={group.label}>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {group.options.map((option) => (
                        <FacetChip
                          key={option.id}
                          option={option}
                          icon={group.presentation === "icons"}
                          onClick={() => onToggle(group.id as FilterFacetId, option.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {properties.length > 0 ? (
            <div className="rounded-md border border-border/60 bg-amber-50/60 px-3 py-2">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Cost &amp; Might
              </p>
              <div className="grid gap-2">
                {properties.map((group) => (
                  <div key={group.id} role="group" aria-label={group.label}>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {group.options.map((option) => (
                        <FacetChip
                          key={option.id}
                          option={option}
                          onClick={() => onToggle(group.id as FilterFacetId, option.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-3 border-t border-border/60 pt-2">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Advanced
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {advancedChips.map((group) => (
              <div key={group.id} className="sm:col-span-3" role="group" aria-label={group.label}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1">
                  {group.options.map((option) => (
                    <FacetChip
                      key={option.id}
                      option={option}
                      onClick={() => onToggle(group.id as FilterFacetId, option.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {searchable.map((group) => (
              <div key={group.id} className="min-w-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {group.label}
                </p>
                <SearchSelect group={group} onToggle={onToggle} />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-3 border-t border-border/60 pt-2 sm:grid-cols-3">
          {status.map((group) => {
            const option = group.options[0];
            if (!option) return null;
            return (
              <div key={group.id} className="min-w-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {group.label}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-foreground/80">
                    {option.label}
                    <span className="ml-1 text-muted-foreground">{option.count}</span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={option.active}
                    aria-label={option.label}
                    disabled={option.disabled}
                    onClick={() => onToggleStatus(group.id as StatusFacetId)}
                    className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
                      option.active
                        ? "border-foreground bg-foreground"
                        : "border-border bg-secondary"
                    } ${option.disabled ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <span
                      className={`absolute top-0.5 size-3.5 rounded-full bg-background shadow transition-[left] ${
                        option.active ? "left-[1.15rem]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
