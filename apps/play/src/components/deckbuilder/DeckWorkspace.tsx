"use client";

import { useState, type ReactNode } from "react";
import type { Card, DeckSectionKey, DeckSections, ParsedDeckEntry } from "@rift/cards";

import { BuilderIcon } from "./BuilderIcon";
import { DeckSection } from "./DeckSection";
import { FullArtView } from "./FullArtView";
import { StatsView } from "./StatsView";
import { SECTION_LABELS, T } from "./strings";
import type { DeckListGroupKey, DeckListSortKey, SortDirection, WorkspaceTab } from "./types";
import { AnchorPopover, Segmented, iconButton, labeledButton } from "./ui";

export interface WorkspaceHandlers {
  cardFor: (entry: ParsedDeckEntry) => Card | undefined;
  canIncrement: (section: DeckSectionKey, entry: ParsedDeckEntry) => boolean;
  onIncrement: (section: DeckSectionKey, entry: ParsedDeckEntry) => void;
  onDecrement: (section: DeckSectionKey, entry: ParsedDeckEntry) => void;
  onMove: (section: DeckSectionKey, entry: ParsedDeckEntry) => void;
  onViewEntry: (section: DeckSectionKey, entry: ParsedDeckEntry) => void;
  onChooseArt: (section: DeckSectionKey, entry: ParsedDeckEntry) => void;
  onEmptyAction: (section: DeckSectionKey) => void;
  onDragEntryStart: (section: DeckSectionKey, entry: ParsedDeckEntry) => void;
  onDragEnd: () => void;
  onSectionDragOver: (section: DeckSectionKey, event: React.DragEvent) => void;
  onSectionDrop: (section: DeckSectionKey, event: React.DragEvent) => void;
  dragOverSection: DeckSectionKey | null;
}

export interface DeckWorkspaceProps {
  mobile?: boolean;
  sections: DeckSections;
  totals: Record<DeckSectionKey, number>;
  startingLegendVacant: boolean;
  name: string;
  onNameChange: (name: string) => void;
  namePlaceholder: string;
  statusText: string;
  statusTone: string;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  onOpenImport: () => void;
  onOpenExport: () => void;
  exportOpen: boolean;
  onExportOpenChange: (open: boolean) => void;
  exportMenu: ReactNode;
  onOpenGuide: () => void;
  onOpenDiscard: () => void;
  onPlay: () => void;
  ready: boolean;
  issues: string[];
  workspaceTab: WorkspaceTab;
  onWorkspaceTabChange: (tab: WorkspaceTab) => void;
  groupKey: DeckListGroupKey;
  sortKey: DeckListSortKey;
  sortDirection: SortDirection;
  onGroupKeyChange: (key: DeckListGroupKey) => void;
  onSortKeyChange: (key: DeckListSortKey) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
  handlers: WorkspaceHandlers;
  copiesLayout: "stacked" | "separate";
  fullArtSize: "xxsmall" | "xsmall" | "small" | "medium" | "large" | "xlarge";
  onCopiesLayoutChange: (layout: "stacked" | "separate") => void;
  onFullArtSizeChange: (
    size: "xxsmall" | "xsmall" | "small" | "medium" | "large" | "xlarge",
  ) => void;
  deckOnly: boolean;
  onToggleDeckOnly: () => void;
  /** Mobile: compact header with the extra overview controls. */
  onMobileNameToggle?: () => void;
  mobileNameOpen?: boolean;
}

function TabButton({
  tab,
  label,
  active,
  mobile,
  onSelect,
}: {
  tab: WorkspaceTab;
  label: string;
  active: boolean;
  mobile: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`${mobile ? "mobile" : "desktop"}-deck-workspace-${tab}-tab`}
      aria-selected={active}
      aria-controls={`${mobile ? "mobile" : "desktop"}-deck-workspace-panel-${tab}`}
      onClick={onSelect}
      className={`inline-flex h-7 items-center rounded-md px-2.5 text-[12px] font-semibold transition-colors ${
        active ? "bg-foreground text-background shadow-sm" : "text-foreground/72 hover:bg-secondary"
      }`}
    >
      {label}
    </button>
  );
}

export function DeckWorkspace({
  mobile = false,
  sections,
  totals,
  startingLegendVacant,
  name,
  onNameChange,
  namePlaceholder,
  statusText,
  statusTone,
  saving,
  canSave,
  onSave,
  onOpenImport,
  onOpenExport,
  exportOpen,
  onExportOpenChange,
  exportMenu,
  onOpenGuide,
  onOpenDiscard,
  onPlay,
  ready,
  issues,
  workspaceTab,
  onWorkspaceTabChange,
  groupKey,
  sortKey,
  sortDirection,
  onGroupKeyChange,
  onSortKeyChange,
  onSortDirectionChange,
  handlers,
  copiesLayout,
  fullArtSize,
  onCopiesLayoutChange,
  onFullArtSizeChange,
  deckOnly,
  onToggleDeckOnly,
  onMobileNameToggle,
  mobileNameOpen = false,
}: DeckWorkspaceProps) {
  const [issuesOpen, setIssuesOpen] = useState(false);
  const issueCount = issues.length;
  const tabsId = mobile ? "mobile" : "desktop";
  const legendRows = startingLegendVacant ? [] : sections.legend.slice(0, 1);
  const additionalLegends = startingLegendVacant ? sections.legend : sections.legend.slice(1);

  const sectionProps = (section: DeckSectionKey) => ({
    section,
    label: SECTION_LABELS[section],
    entries: section === "legend" && !startingLegendVacant ? legendRows : sections[section],
    total:
      section === "legend"
        ? startingLegendVacant
          ? 0
          : Math.min(totals.legend, 1)
        : totals[section],
    required:
      section === "legend"
        ? 1
        : section === "champion"
          ? 1
          : section === "mainDeck"
            ? 39
            : section === "battlefields"
              ? 3
              : section === "runes"
                ? 12
                : 10,
    cap: section === "sideboard",
    mobile,
    cardFor: handlers.cardFor,
    canIncrement: (entry: ParsedDeckEntry) => handlers.canIncrement(section, entry),
    moveTarget:
      section === "mainDeck"
        ? ("Sideboard" as const)
        : section === "sideboard"
          ? ("Main Deck" as const)
          : undefined,
    onIncrement: (entry: ParsedDeckEntry) => handlers.onIncrement(section, entry),
    onDecrement: (entry: ParsedDeckEntry) => handlers.onDecrement(section, entry),
    onMove: (entry: ParsedDeckEntry) => handlers.onMove(section, entry),
    onViewDetails: (entry: ParsedDeckEntry) => handlers.onViewEntry(section, entry),
    onChooseArt: (entry: ParsedDeckEntry) => handlers.onChooseArt(section, entry),
    onEmptyAction: () => handlers.onEmptyAction(section),
    onDragEntryStart: (entry: ParsedDeckEntry) => handlers.onDragEntryStart(section, entry),
    onDragEnd: handlers.onDragEnd,
    onDragOver: (event: React.DragEvent) => handlers.onSectionDragOver(section, event),
    onDrop: (event: React.DragEvent) => handlers.onSectionDrop(section, event),
    isDragOver: handlers.dragOverSection === section,
    groupKey: section === "mainDeck" || section === "sideboard" ? groupKey : undefined,
    sortKey: section === "mainDeck" || section === "sideboard" ? sortKey : undefined,
    sortDirection,
    onGroupKeyChange:
      section === "mainDeck" || section === "sideboard" ? onGroupKeyChange : undefined,
    onSortKeyChange:
      section === "mainDeck" || section === "sideboard" ? onSortKeyChange : undefined,
    onSortDirectionChange:
      section === "mainDeck" || section === "sideboard" ? onSortDirectionChange : undefined,
    ...(section === "legend"
      ? {
          additionalEntries: additionalLegends,
          additionalLabel: T.additionalLegends,
          additionalCap: 3,
        }
      : {}),
  });

  const fullArtSizeSteps = ["xxsmall", "xsmall", "small", "medium", "large", "xlarge"] as const;
  const fullArtSizeIndex = Math.max(1, fullArtSizeSteps.indexOf(fullArtSize) + 1);
  const fullArtControls = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Segmented
        ariaLabel={T.fullArt}
        value={copiesLayout}
        onChange={(value) => onCopiesLayoutChange(value as "stacked" | "separate")}
        options={[
          { value: "stacked", label: T.selectedStacked },
          { value: "separate", label: T.selectedAllCopies },
        ]}
      />
      {mobile ? (
        <span className="inline-flex items-center gap-0.5 rounded-md border border-border/70 bg-background/80 p-0.5">
          {(
            [
              ["small", "S"],
              ["medium", "M"],
              ["large", "L"],
            ] as const
          ).map(([size, label]) => (
            <button
              key={size}
              type="button"
              aria-pressed={fullArtSize === size}
              aria-label={`${label} full art size`}
              onClick={() => onFullArtSizeChange(size)}
              className={`inline-flex h-6 w-6 items-center justify-center rounded text-[11px] font-semibold ${
                fullArtSize === size
                  ? "bg-foreground text-background"
                  : "text-foreground/70 hover:bg-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="tabular-nums">
            {fullArtSizeIndex}/{fullArtSizeSteps.length}
          </span>
          <input
            aria-label="Full art size"
            type="range"
            min={1}
            max={fullArtSizeSteps.length}
            step={1}
            value={fullArtSizeIndex}
            onChange={(event) => {
              const size = fullArtSizeSteps[Number(event.target.value) - 1];
              if (size) onFullArtSizeChange(size);
            }}
            className="db-range w-24"
          />
        </span>
      )}
    </div>
  );

  const listContent = (
    <>
      <div className="grid gap-3 min-[640px]:grid-cols-2">
        <DeckSection {...sectionProps("legend")} />
        <DeckSection {...sectionProps("champion")} />
      </div>
      <DeckSection {...sectionProps("mainDeck")} />
      <DeckSection {...sectionProps("battlefields")} />
      <DeckSection {...sectionProps("sideboard")} />
      <DeckSection {...sectionProps("runes")} />
    </>
  );

  const mainContent = (
    <div className={mobile ? "grid gap-5" : "grid gap-5"}>
      <div data-deck-workspace-column="main" className="grid min-w-0 content-start gap-6">
        <div className="grid items-start gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))]">
          <DeckSection {...sectionProps("legend")} />
          <DeckSection {...sectionProps("champion")} />
        </div>
        <DeckSection {...sectionProps("mainDeck")} />
      </div>
      <div data-deck-workspace-column="side" className="grid min-w-0 content-start gap-6">
        <DeckSection {...sectionProps("battlefields")} />
        <DeckSection {...sectionProps("sideboard")} />
        <DeckSection {...sectionProps("runes")} />
      </div>
    </div>
  );

  return (
    <div
      data-testid={mobile ? "mobile-deck-workspace-panel" : "desktop-deck-workspace-panel"}
      className={`relative flex h-full min-h-0 flex-col ${mobile ? "bg-secondary/[0.06]" : ""}`}
    >
      <div
        data-deck-workspace-header="true"
        className="@container border-b border-border/50 bg-[linear-gradient(180deg,rgba(247,248,252,0.9),rgba(240,242,248,0.62))] px-4 py-1.5"
      >
        <div className="grid gap-x-2 gap-y-1.5">
          {mobile ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div
                  role="tablist"
                  aria-label={T.deckWorkspaceView}
                  className="flex min-w-0 items-center gap-1 rounded-md border border-border/70 bg-background/80 p-0.5"
                >
                  <TabButton
                    tab="list"
                    label={T.list}
                    active={workspaceTab === "list"}
                    mobile
                    onSelect={() => onWorkspaceTabChange("list")}
                  />
                  <TabButton
                    tab="fullArt"
                    label={T.fullArt}
                    active={workspaceTab === "fullArt"}
                    mobile
                    onSelect={() => onWorkspaceTabChange("fullArt")}
                  />
                  <TabButton
                    tab="stats"
                    label={T.stats}
                    active={workspaceTab === "stats"}
                    mobile
                    onSelect={() => onWorkspaceTabChange("stats")}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  {issueCount > 0 ? (
                    <button
                      type="button"
                      aria-expanded={issuesOpen}
                      aria-label={T.validationIssues(issueCount)}
                      onClick={() => setIssuesOpen((current) => !current)}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-500/40 bg-amber-50 px-2 text-[11px] font-semibold text-amber-800"
                    >
                      <BuilderIcon name="warning" className="h-3.5 w-3.5" />
                      {issueCount}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={!canSave || saving}
                    className={labeledButton}
                  >
                    <BuilderIcon name="save" className="h-4 w-4" />
                    <span>{T.save}</span>
                  </button>
                  <button type="button" onClick={onOpenGuide} className={labeledButton}>
                    <BuilderIcon name="guide" className="h-4 w-4" />
                    <span>{T.edit}</span>
                  </button>
                </div>
              </div>
              {workspaceTab === "fullArt" ? (
                <div className="flex justify-end pt-0.5">{fullArtControls}</div>
              ) : null}
              {mobileNameOpen ? (
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    id="mobile-deck-name-input"
                    aria-label={T.deckName}
                    value={name}
                    onChange={(event) => onNameChange(event.target.value)}
                    placeholder={namePlaceholder}
                    maxLength={80}
                    className="h-8 w-full rounded-md border border-border/70 bg-background/85 px-2.5 text-sm font-semibold outline-none focus:border-foreground/30"
                  />
                  <button
                    type="button"
                    onClick={onPlay}
                    disabled={!ready}
                    aria-label={T.playInSimulator}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-[#d4a017] px-3 text-sm font-semibold text-[#1d1400] shadow-sm transition-colors hover:bg-[#e0ad22] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <BuilderIcon name="play" className="h-3.5 w-3.5" />
                    <span className="hidden min-[420px]:inline">{T.playInSimulator}</span>
                  </button>
                  {onMobileNameToggle ? (
                    <button
                      type="button"
                      aria-label={T.toggleDeckOverview}
                      onClick={onMobileNameToggle}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background"
                    >
                      <BuilderIcon name="chevron-up" className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    {T.deckWorkspace}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${statusTone}`}
                  >
                    {saving ? (
                      <span
                        className="size-2 animate-pulse rounded-full bg-current"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span>{statusText}</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-deck-workspace-toolbar-action="true"
                    aria-label={T.save}
                    onClick={onSave}
                    disabled={!canSave || saving}
                    className={labeledButton}
                  >
                    <BuilderIcon name="save" className="h-4 w-4" />
                    <span>{T.save}</span>
                  </button>
                  <span className="group/deck-workspace-action relative inline-flex">
                    <button
                      type="button"
                      data-deck-workspace-toolbar-action="true"
                      aria-label={T.importDeckAction}
                      onClick={onOpenImport}
                      className={iconButton}
                    >
                      <BuilderIcon name="import" className="h-4 w-4" />
                    </button>
                  </span>
                  <div className="group/deck-workspace-export relative inline-flex">
                    <button
                      type="button"
                      data-deck-workspace-toolbar-action="true"
                      aria-label={T.exportDeck}
                      aria-haspopup="dialog"
                      aria-expanded={exportOpen}
                      disabled={
                        totals.legend +
                          totals.champion +
                          totals.mainDeck +
                          totals.battlefields +
                          totals.runes +
                          totals.sideboard ===
                        0
                      }
                      onClick={() => onExportOpenChange(!exportOpen)}
                      className={iconButton}
                    >
                      <BuilderIcon name="export" className="h-4 w-4" />
                    </button>
                    <AnchorPopover
                      open={exportOpen}
                      onClose={() => onExportOpenChange(false)}
                      ariaLabel={T.exportDeckOptions}
                      className="w-56"
                    >
                      {exportMenu}
                    </AnchorPopover>
                  </div>
                  <span className="group/deck-workspace-action relative inline-flex">
                    <button
                      type="button"
                      data-deck-workspace-toolbar-action="true"
                      aria-label={T.private}
                      title={T.private}
                      disabled
                      className={iconButton}
                    >
                      <BuilderIcon name="lock" className="h-4 w-4" />
                    </button>
                  </span>
                  <button
                    type="button"
                    aria-label={deckOnly ? T.showCardBrowser : T.showDeckOnly}
                    data-testid="deck-only-toggle"
                    aria-pressed={deckOnly}
                    onClick={onToggleDeckOnly}
                    className={iconButton}
                  >
                    <BuilderIcon name={deckOnly ? "collapse" : "expand"} className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="deck-name-input"
                  aria-label={T.deckName}
                  value={name}
                  onChange={(event) => onNameChange(event.target.value)}
                  placeholder={namePlaceholder}
                  maxLength={80}
                  className="h-8 min-w-0 flex-1 rounded-md border border-border/70 bg-background/85 px-3 text-sm font-semibold text-foreground outline-none transition-colors placeholder:font-medium placeholder:text-muted-foreground focus:border-foreground/30"
                />
                <button
                  type="button"
                  aria-label={T.editDeckGuide}
                  onClick={onOpenGuide}
                  className={labeledButton}
                >
                  <BuilderIcon name="guide" className="h-4 w-4" />
                  <span>{T.guide}</span>
                </button>
                <button
                  type="button"
                  aria-label={T.playInSimulator}
                  title={ready ? T.playInSimulator : T.incompleteDeckSaveNote}
                  onClick={onPlay}
                  disabled={!ready}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-[#d9a520] px-3 text-sm font-semibold text-[#1d1400] shadow-sm transition-colors hover:bg-[#e7b52b] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <BuilderIcon name="play" className="h-3.5 w-3.5" />
                  <span>{T.playInSimulator}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div
                  role="tablist"
                  aria-label={T.deckWorkspaceView}
                  className="inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-background/70 p-0.5"
                >
                  <TabButton
                    tab="list"
                    label={T.list}
                    active={workspaceTab === "list"}
                    mobile={false}
                    onSelect={() => onWorkspaceTabChange("list")}
                  />
                  <TabButton
                    tab="fullArt"
                    label={T.fullArt}
                    active={workspaceTab === "fullArt"}
                    mobile={false}
                    onSelect={() => onWorkspaceTabChange("fullArt")}
                  />
                  <TabButton
                    tab="stats"
                    label={T.stats}
                    active={workspaceTab === "stats"}
                    mobile={false}
                    onSelect={() => onWorkspaceTabChange("stats")}
                  />
                </div>
                {workspaceTab === "fullArt" ? fullArtControls : null}
                <div className="flex items-center gap-2">
                  {issueCount > 0 ? (
                    <div className="relative">
                      <button
                        type="button"
                        aria-label={T.validationIssues(issueCount)}
                        aria-expanded={issuesOpen}
                        aria-controls="deck-workspace-issues"
                        onClick={() => setIssuesOpen((current) => !current)}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-500/40 bg-amber-50 px-2 text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                      >
                        <BuilderIcon name="warning" className="h-3.5 w-3.5" />
                        <span>{T.issuesCount(issueCount)}</span>
                        <BuilderIcon
                          name={issuesOpen ? "chevron-up" : "chevron-down"}
                          className="h-3 w-3"
                        />
                      </button>
                      <AnchorPopover
                        id="deck-workspace-issues"
                        open={issuesOpen}
                        onClose={() => setIssuesOpen(false)}
                        ariaLabel={`${issueCount} deck validation issues`}
                        className="w-[min(28rem,calc(100vw-2rem))]"
                      >
                        <div className="px-3 py-2">
                          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                            {T.validationIssues(issueCount)}
                          </p>
                          <ul className="db-thin-scrollbar max-h-72 space-y-1 overflow-y-auto text-xs text-foreground/80">
                            {issues.map((issue, index) => (
                              <li
                                key={`${issue}-${index}`}
                                className="rounded bg-amber-50/70 px-2 py-1"
                              >
                                {issue}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </AnchorPopover>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    aria-label={T.discardDraft}
                    onClick={onOpenDiscard}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <BuilderIcon name="trash" className="h-3.5 w-3.5" />
                    <span>{T.discardDraft}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div
        id={`${tabsId}-deck-workspace-panel-${workspaceTab}`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-deck-workspace-${workspaceTab}-tab`}
        data-deck-workspace-scroll="true"
        className="db-workspace-scroll db-thin-scrollbar @container px-4"
      >
        {workspaceTab === "stats" ? (
          <div className="pt-3">
            <StatsView sections={sections} />
          </div>
        ) : workspaceTab === "fullArt" ? (
          <div className="pt-3">
            <FullArtView
              sections={sections}
              cardFor={handlers.cardFor}
              copiesLayout={copiesLayout}
              fullArtSize={fullArtSize}
              groupKey={groupKey}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onGroupKeyChange={onGroupKeyChange}
              onSortKeyChange={onSortKeyChange}
              onSortDirectionChange={onSortDirectionChange}
              onIncrement={handlers.onIncrement}
              onDecrement={handlers.onDecrement}
              onViewDetails={(entry) => handlers.onViewEntry("mainDeck", entry)}
              onChooseArt={handlers.onChooseArt}
              onEmptySection={handlers.onEmptyAction}
            />
          </div>
        ) : mobile ? (
          <div className="grid gap-5 pb-6 pt-3">{listContent}</div>
        ) : (
          <div data-deck-workspace-columns="auto" className="db-workspace-columns py-3">
            {mainContent}
          </div>
        )}
      </div>
    </div>
  );
}
