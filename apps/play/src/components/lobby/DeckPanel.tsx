"use client";

import { strings as copy } from "./strings";
import type { ParsedDeck } from "./types";
import { DeckList } from "./DeckList";
import { DeckStats } from "./DeckStats";
import { Icon } from "@/components/ui/Icon";
import { deckActionButton } from "@/components/ui/buttonStyles";

export type DeckPanelView = "list" | "stats";

export interface DeckPanelProps {
  deck: ParsedDeck | null;
  savedDeckName?: string | null;
  signedIn: boolean;
  privateDeck: boolean;
  onPrivateDeckChange: (value: boolean) => void;
  view: DeckPanelView;
  onViewChange: (view: DeckPanelView) => void;
  detailsOpen: boolean;
  onDetailsOpenChange: (open: boolean) => void;
  onImportDeck: () => void;
  onNewDeck: () => void;
  onChooseDeck: () => void;
  onSaveDeck: () => void;
}

function formatCounts(deck: ParsedDeck | null) {
  return [
    { id: "legend", label: copy["sim.deckProfile.legend"], value: `${deck?.totals.legend ?? 0}/1` },
    {
      id: "champion",
      label: copy["sim.deckProfile.champion"],
      value: `${deck?.totals.champion ?? 0}/1`,
    },
    {
      id: "mainDeck",
      label: copy["sim.deckProfile.mainDeck"],
      value: `${deck?.totals.mainDeck ?? 0}/39`,
    },
    {
      id: "battlefields",
      label: copy["sim.deckProfile.battlefields"],
      value: `${deck?.totals.battlefields ?? 0}/3`,
    },
    { id: "runes", label: copy["sim.deckProfile.runes"], value: `${deck?.totals.runes ?? 0}/12` },
    {
      id: "sideboard",
      label: copy["sim.deckProfile.sideboard"],
      value: `${deck?.totals.sideboard ?? 0}/10`,
    },
  ];
}

export function DeckPanel({
  deck,
  savedDeckName,
  signedIn,
  privateDeck,
  onPrivateDeckChange,
  view,
  onViewChange,
  detailsOpen,
  onDetailsOpenChange,
  onImportDeck,
  onNewDeck,
  onChooseDeck,
  onSaveDeck,
}: DeckPanelProps) {
  const legend = deck?.sections.legend[0] ?? null;
  const heading = legend?.name ?? (savedDeckName || copy["sim.pasteDeck"]);
  const statusLabel = !deck
    ? copy["sim.chooseOrImportDeck"]
    : !deck.valid
      ? copy["sim.resolveBlockingDeckIssuesBeforeImporting"]
      : null;
  const counts = formatCounts(deck);
  const frameMode = !deck ? "fallback" : legend?.imageUrl ? "art" : "silhouette";
  const libraryTitle = signedIn ? undefined : copy["sim.signInDeckLibrary"];

  return (
    <section
      className="lobby-deck-column grid min-w-0 self-start gap-4"
      data-deck-details-open={detailsOpen ? "true" : "false"}
    >
      <div className="lobby-deck-surface relative grid gap-7 px-1">
        <div
          className="pointer-events-none absolute left-[10%] -top-24 h-136 w-136 max-w-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 48% 44%, rgba(110, 78, 255, 0.32) 0%, rgba(110, 78, 255, 0.32) 6%, transparent 73%)",
            filter: "blur(70px)",
            opacity: 0.35,
          }}
        />
        <div
          className="pointer-events-none absolute left-[34%] top-32 h-136 w-136 max-w-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 38% 34%, rgba(81, 225, 255, 0.22) 0%, rgba(81, 225, 255, 0.22) 6%, transparent 73%)",
            filter: "blur(70px)",
            opacity: 0.35,
          }}
        />

        <div className="lobby-deck-overview relative grid gap-7 pb-2 md:grid-cols-[11rem_minmax(0,1fr)]">
          <aside className="lobby-deck-portrait grid content-start gap-4">
            <div
              className={
                frameMode === "fallback"
                  ? "relative aspect-[63/88] border border-[rgba(231,201,139,0.18)] bg-[linear-gradient(180deg,rgba(34,22,43,0.96),rgba(13,10,21,0.98))] shadow-[0_0_18px_rgba(109,72,255,0.1)]"
                  : frameMode === "silhouette"
                    ? "relative aspect-[63/88] bg-transparent"
                    : "relative aspect-[63/88] overflow-hidden border border-[rgba(231,201,139,0.18)] bg-[linear-gradient(180deg,rgba(34,22,43,0.96),rgba(13,10,21,0.98))] shadow-[0_0_18px_rgba(109,72,255,0.1)]"
              }
              data-card-art-frame={frameMode}
              data-testid="sim-lobby-deck-preview"
            >
              {legend?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={legend.imageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover object-top"
                />
              ) : null}
            </div>
            <div className="grid gap-y-1.5 text-[0.74rem] uppercase tracking-[0.12em] text-[#b9c7da]">
              {counts.map((row) => (
                <div key={row.id} className="flex items-baseline justify-between gap-3">
                  <span>{row.label}</span>
                  <strong className="text-gb-text-main">{row.value}</strong>
                </div>
              ))}
            </div>
          </aside>

          <div className="lobby-deck-content grid min-h-0 content-start gap-6">
            <div className="lobby-deck-heading flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(112,196,214,0.08)] pb-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="truncate text-[1.2rem] font-semibold text-gb-text-main">
                    {heading}
                  </p>
                  {savedDeckName && legend && savedDeckName !== heading ? (
                    <span className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[#8ea4bf]">
                      {savedDeckName}
                    </span>
                  ) : null}
                </div>
                {statusLabel ? (
                  <p className="mt-2 inline-flex max-w-full border px-2.5 py-1 text-[0.74rem] font-medium leading-snug border-[rgba(242,138,138,0.54)] bg-[rgba(91,22,22,0.46)] text-[#ffd5d5]">
                    {statusLabel}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="lobby-deck-details-toggle hidden min-h-11 items-center justify-center gap-2 border border-[rgba(132,150,184,0.24)] px-3 text-sm text-text-soft"
                aria-expanded={detailsOpen}
                aria-controls="lobby-deck-details"
                onClick={() => onDetailsOpenChange(!detailsOpen)}
              >
                {detailsOpen ? copy["sim.hideDeckDetails"] : copy["sim.showDeckDetails"]}
                <Icon
                  name="chevron-right"
                  className={`h-4 w-4 shrink-0 transition-transform ${detailsOpen ? "rotate-90" : ""}`}
                />
              </button>
              <div className="lobby-deck-toolbar flex w-full items-center justify-between gap-3">
                <div
                  role="tablist"
                  aria-label={copy["sim.deckPanelView"]}
                  className="inline-grid grid-cols-2 border border-[rgba(132,150,184,0.18)] bg-[rgba(5,10,20,0.48)] p-0.5"
                >
                  {(["list", "stats"] as const).map((tab) => {
                    const selected = view === tab;
                    return (
                      <button
                        key={tab}
                        id={`deck-${tab}-tab`}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls={`deck-${tab}-panel`}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onViewChange(tab)}
                        className={`inline-flex h-8 min-w-18 items-center justify-center px-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(161,230,255,0.55)] ${
                          selected
                            ? "bg-[rgba(120,196,255,0.16)] text-[#edf8ff] shadow-[inset_0_0_0_1px_rgba(161,230,255,0.18)]"
                            : "text-[#8ea4bf] hover:bg-[rgba(132,150,184,0.08)] hover:text-[#dbe8f6]"
                        }`}
                      >
                        {tab === "list" ? copy["sim.list"] : copy["sim.stats"]}
                      </button>
                    );
                  })}
                </div>
                <label
                  title={signedIn ? undefined : copy["sim.signInPrivacy"]}
                  className="flex min-h-9 cursor-pointer items-center gap-2 whitespace-nowrap text-[0.7rem] font-medium text-[#9eb1c8] transition-colors hover:text-[#edf8ff] has-checked:text-[#b6e7ed] has-disabled:cursor-default has-disabled:opacity-50"
                >
                  <input
                    disabled={!signedIn}
                    className="size-3.5 accent-[#83dbe8]"
                    type="checkbox"
                    checked={privateDeck}
                    onChange={(event) => onPrivateDeckChange(event.currentTarget.checked)}
                  />
                  <Icon name="lock-keyhole" className="size-3" />
                  {copy["sim.privateDeck"]}
                </label>
              </div>
            </div>

            <div id="lobby-deck-details" className="lobby-deck-details contents">
              {deck ? (
                view === "list" ? (
                  <DeckList sections={deck.sections} />
                ) : (
                  <DeckStats deck={deck} />
                )
              ) : (
                <DeckList
                  sections={{
                    legend: [],
                    champion: [],
                    mainDeck: [],
                    battlefields: [],
                    runes: [],
                    sideboard: [],
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <div className="lobby-deck-actions relative grid gap-4 pt-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              <button type="button" className={`${deckActionButton} px-5`} onClick={onImportDeck}>
                <Icon name="upload" className="h-3.5 w-3.5" strokeWidth={2.1} />
                {copy["sim.importDeck"]}
              </button>
            </span>
            <span title={libraryTitle}>
              <button type="button" className={`${deckActionButton} px-5`} onClick={onNewDeck}>
                <Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2.1} />
                {copy["sim.newDeck"]}
              </button>
            </span>
          </div>
          <div />
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <span title={libraryTitle}>
              <button type="button" className={`${deckActionButton} px-4`} onClick={onChooseDeck}>
                <Icon name="folder-open" className="h-3.5 w-3.5" strokeWidth={2.1} />
                {!signedIn ? <Icon name="lock" className="h-3.5 w-3.5" strokeWidth={2.1} /> : null}
                {copy["sim.chooseDeck"]}
              </button>
            </span>
            <span title={libraryTitle}>
              <button
                type="button"
                className={`${deckActionButton} px-4`}
                disabled={!signedIn || !deck}
                onClick={onSaveDeck}
              >
                <Icon name="save" className="h-3.5 w-3.5" strokeWidth={2.1} />
                {!signedIn ? <Icon name="lock" className="h-3.5 w-3.5" strokeWidth={2.1} /> : null}
                {copy["sim.saveDeck"]}
              </button>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
