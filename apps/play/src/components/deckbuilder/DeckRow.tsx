"use client";

import type { Card, DeckSectionKey, ParsedDeckEntry } from "@rift/cards";

import { CardArt } from "./CardArt";
import { BuilderIcon } from "./BuilderIcon";
import { printVariants } from "./catalog";
import { SECTION_LABELS, T } from "./strings";
import { DomainIcon } from "./ui";

export interface DeckRowProps {
  entry: ParsedDeckEntry;
  card: Card | undefined;
  section: DeckSectionKey;
  canIncrement: boolean;
  moveTarget?: "Main Deck" | "Sideboard";
  onIncrement: () => void;
  onDecrement: () => void;
  onMove: () => void;
  onViewDetails: () => void;
  onChooseArt?: () => void;
  onDragStart: (entry: ParsedDeckEntry) => void;
  onDragEnd: () => void;
  onDragOver?: (event: React.DragEvent) => void;
  onDrop?: (event: React.DragEvent) => void;
  isDragOver?: boolean;
}

function EnergyChip({ value }: { value: number }) {
  return (
    <span className="inline-flex h-[0.95rem] min-w-[0.95rem] items-center justify-center rounded-[0.22rem] border border-black/10 bg-white px-[0.18rem] text-[10px] font-semibold leading-none text-black">
      {value}
    </span>
  );
}

function PowerIcons({ card }: { card: Card }) {
  const power = card.powerCost ?? 0;
  if (power <= 0) return null;
  return (
    <span
      role="img"
      aria-label={`${card.domains.join("/")} power ${power}`}
      className="inline-flex items-center -space-x-[0.18rem]"
    >
      {(card.domains.length > 0 ? card.domains : ["Unknown"]).map((domain) => (
        <DomainIcon key={domain} domain={domain} className="size-[11px] rounded-[0.08rem]" />
      ))}
    </span>
  );
}

export function DeckRow({
  entry,
  card,
  section,
  canIncrement,
  moveTarget,
  onIncrement,
  onDecrement,
  onMove,
  onViewDetails,
  onChooseArt,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragOver = false,
}: DeckRowProps) {
  const prints = card ? printVariants(card) : [];
  const showArtPicker = prints.length > 1;
  const energy = card?.energyCost ?? 0;
  const might = card?.might ?? 0;
  const showStats = section !== "legend";
  const incrementLabel = T.increaseQuantity(entry.name, SECTION_LABELS[section]);
  const decrementLabel = T.decreaseQuantity(entry.name, SECTION_LABELS[section]);
  const moveLabel = moveTarget ? T.moveOneCopyToSection(entry.name, moveTarget) : "";
  const ariaEnergy = energy > 0 ? `${energy} energy` : "";
  const ariaMight = might > 0 ? `${might} might` : "";
  const metaLabel = [ariaEnergy, ariaMight].filter(Boolean).join(" · ");

  const thumbButton = (
    <button
      type="button"
      data-deckbuilder-drag-handle={!showArtPicker ? "true" : undefined}
      aria-label={showArtPicker ? `Choose art for ${entry.name}` : T.previewCard(entry.name)}
      title={showArtPicker ? T.showArtVariants(prints.length) : undefined}
      onClick={showArtPicker ? onChooseArt : undefined}
      className="group/deck-thumb relative h-[3.2rem] w-[4.35rem] overflow-visible rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55"
    >
      <span className="absolute inset-0 overflow-hidden rounded-[0.16rem] border border-black/70 bg-[linear-gradient(180deg,rgba(24,31,48,0.08),rgba(10,14,24,0.16))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
        {card ? (
          <CardArt
            card={card}
            slot="small"
            sizes="70px"
            className="h-full w-full scale-[1.08] object-cover object-[center_6%] opacity-[0.95] saturate-[0.92]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-slate-800 px-1 text-center text-[9px] text-white">
            {entry.name}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 h-px bg-black/20" />
        {prints.length > 1 && (section === "legend" || section === "champion") ? (
          <span className="absolute right-1 top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-[0.28rem] border border-white/18 bg-[rgba(7,10,18,0.76)] px-1 py-[0.08rem] text-[9px] font-semibold leading-none text-white/88 shadow-[0_1px_4px_rgba(0,0,0,0.28)] backdrop-blur-sm">
            {prints.length} alt arts
          </span>
        ) : null}
      </span>
    </button>
  );

  const controls = (
    <div className="flex shrink-0 justify-self-center flex-col items-center gap-0.5">
      <button
        type="button"
        aria-label={incrementLabel}
        disabled={!canIncrement || section === "legend" || section === "champion"}
        onClick={onIncrement}
        className="inline-flex h-5.5 w-5 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55"
      >
        <BuilderIcon name="plus" className="h-3 w-3" />
      </button>
      <button
        type="button"
        data-deck-entry-decrement="true"
        aria-label={decrementLabel}
        onClick={onDecrement}
        className="inline-flex h-5.5 w-5 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55"
      >
        <BuilderIcon name="minus" className="h-3 w-3" />
      </button>
    </div>
  );

  const rowActions = (
    <span
      data-deck-entry-row-actions="true"
      className="ml-auto inline-flex shrink-0 items-center gap-0"
    >
      {moveTarget ? (
        <button
          type="button"
          data-deck-entry-move="true"
          aria-label={moveLabel}
          title={moveLabel}
          onClick={onMove}
          className="inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <BuilderIcon name="move" className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <button
        type="button"
        aria-label={T.viewDetailsFor(entry.name)}
        title="View card details"
        onClick={onViewDetails}
        className="inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55"
      >
        <BuilderIcon name="expand" className="h-3.5 w-3.5" />
      </button>
    </span>
  );

  const meta = (
    <div className="mt-1 flex min-w-0 items-center gap-2 text-[10px] leading-none text-muted-foreground">
      <span className="shrink-0 text-[1rem] font-semibold leading-none text-[#6aa4c2]">
        {entry.count}x
      </span>
      {showStats && (energy > 0 || (card?.powerCost ?? 0) > 0 || might > 0) ? (
        <span
          className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap"
          aria-label={metaLabel}
        >
          {energy > 0 ? (
            <span className="inline-flex items-center gap-[0.08rem] text-[10px] leading-none text-muted-foreground">
              <EnergyChip value={energy} />
            </span>
          ) : null}
          {card ? <PowerIcons card={card} /> : null}
          {might > 0 ? (
            <>
              <span className="text-[10px] leading-none text-muted-foreground/70">·</span>
              <span className="inline-flex items-center gap-[0.14rem] text-[12px] leading-none text-muted-foreground">
                <span className="font-semibold text-foreground/90">{might}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="MIGHT"
                  loading="lazy"
                  width={13}
                  height={13}
                  className="rounded-[0.08rem]"
                  src="/riftbound/static/icons/might.webp"
                />
              </span>
            </>
          ) : null}
        </span>
      ) : null}
      {rowActions}
    </div>
  );

  return (
    <>
      {/* Desktop row */}
      <div
        draggable
        data-deckbuilder-drag-source="deck"
        data-copy-count={entry.count}
        data-deck-entry-code={entry.cardCode ?? ""}
        data-deck-entry-identity={
          entry.cardCode ? `code:${entry.cardCode}` : `name:${entry.name.toLowerCase()}`
        }
        data-deck-entry-section={section}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData(
            "text/plain",
            `deck:${section}:${entry.cardCode ?? entry.name}`,
          );
          onDragStart(entry);
        }}
        onDragEnd={onDragEnd}
        onContextMenu={(event) => {
          if (event.shiftKey && moveTarget) {
            event.preventDefault();
            onMove();
          }
        }}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`db-desktop-only relative z-0 grid w-full min-w-0 cursor-grab grid-cols-[4.35rem_1.6rem_minmax(0,1fr)] items-center gap-x-1 justify-self-start rounded-md border border-border/60 bg-background/70 p-1 text-[0.8rem] focus-within:z-20 active:cursor-grabbing ${
          isDragOver ? "db-drag-target" : ""
        }`}
      >
        {thumbButton}
        {controls}
        <div className="min-w-0 self-stretch py-0.5">
          <div className="flex min-w-0 items-center gap-1.5 text-[0.82rem] font-semibold leading-tight text-foreground">
            <span className="truncate">{entry.name}</span>
          </div>
          {meta}
        </div>
      </div>

      {/* Mobile row */}
      <div
        draggable
        data-deckbuilder-drag-source="deck"
        data-copy-count={entry.count}
        data-deck-entry-code={entry.cardCode ?? ""}
        data-deck-entry-identity={
          entry.cardCode ? `code:${entry.cardCode}` : `name:${entry.name.toLowerCase()}`
        }
        data-deck-entry-section={section}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData(
            "text/plain",
            `deck:${section}:${entry.cardCode ?? entry.name}`,
          );
          onDragStart(entry);
        }}
        onDragEnd={onDragEnd}
        onContextMenu={(event) => {
          if (event.shiftKey && moveTarget) {
            event.preventDefault();
            onMove();
          }
        }}
        className={`db-mobile-only relative z-0 grid w-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem_auto] items-center gap-x-2 rounded-lg border border-border/60 bg-background/72 px-1.5 py-1.5 focus-within:z-20 ${
          isDragOver ? "db-drag-target" : ""
        }`}
      >
        <button
          type="button"
          data-deck-entry-decrement="true"
          aria-label={decrementLabel}
          onClick={onDecrement}
          className="inline-flex h-8 w-8 items-center justify-center justify-self-start rounded-lg border border-border bg-background text-foreground/78 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <BuilderIcon name="minus" className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[1rem] font-semibold leading-none text-[#6aa4c2]">
            {entry.count}x
          </span>
          <div className="relative h-[2.55rem] w-[3.4rem] shrink-0 overflow-visible rounded-sm">
            {card ? (
              <CardArt
                card={card}
                slot="small"
                sizes="54px"
                className="h-full w-full scale-[1.08] rounded-sm object-cover object-[center_6%] opacity-[0.95] saturate-[0.92]"
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5 text-[0.76rem] font-semibold leading-tight text-foreground">
              <span className="truncate">{entry.name}</span>
            </div>
            {showStats ? (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[9px] leading-none text-muted-foreground">
                <span
                  className="inline-flex items-center gap-1 whitespace-nowrap"
                  aria-label={metaLabel}
                >
                  {energy > 0 ? <EnergyChip value={energy} /> : null}
                  {card ? <PowerIcons card={card} /> : null}
                  {might > 0 ? (
                    <>
                      <span className="text-[9px] leading-none text-muted-foreground/70">·</span>
                      <span className="inline-flex items-center gap-[0.14rem] text-[12px] leading-none text-muted-foreground">
                        <span className="font-semibold text-foreground/90">{might}</span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt="MIGHT"
                          loading="lazy"
                          width={13}
                          height={13}
                          className="rounded-[0.08rem]"
                          src="/riftbound/static/icons/might.webp"
                        />
                      </span>
                    </>
                  ) : null}
                </span>
              </div>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          aria-label={incrementLabel}
          disabled={!canIncrement || section === "legend" || section === "champion"}
          onClick={onIncrement}
          className="inline-flex h-8 w-8 items-center justify-center justify-self-end rounded-lg border border-border bg-background text-foreground/78 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <BuilderIcon name="plus" className="h-4 w-4" />
        </button>
        <span
          data-deck-entry-row-actions="true"
          className="inline-flex items-center justify-self-end gap-0.5"
        >
          {moveTarget ? (
            <button
              type="button"
              data-deck-entry-move="true"
              aria-label={moveLabel}
              onClick={onMove}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground/78 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
              <BuilderIcon name="move" className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label={T.viewDetailsFor(entry.name)}
            onClick={onViewDetails}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground/78 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            <BuilderIcon name="expand" className="h-4 w-4" />
          </button>
        </span>
      </div>
    </>
  );
}
