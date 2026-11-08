"use client";

import type { Card } from "@rift/cards";

import { CardArt } from "./CardArt";
import { BuilderIcon } from "./BuilderIcon";
import { T } from "./strings";

export interface CardTileProps {
  card: Card;
  deckCount: number;
  bookmarked: boolean;
  banned: boolean;
  onAdd: (card: Card) => void;
  onToggleBookmark: (card: Card) => void;
  onViewDetails: (card: Card) => void;
  onDragStart?: (card: Card) => void;
  onDragEnd?: () => void;
}

export function CardTile({
  card,
  deckCount,
  bookmarked,
  banned,
  onAdd,
  onToggleBookmark,
  onViewDetails,
  onDragStart,
  onDragEnd,
}: CardTileProps) {
  return (
    <article
      data-deck-workspace-catalog-card={card.id}
      data-deck-workspace-bookmark-key={card.id}
      className="group/catalog-card db-catalog-card relative"
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 360px" }}
    >
      <button
        type="button"
        aria-label={T.addToSelectedSection(card.name)}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "copy";
          event.dataTransfer.setData("text/plain", `catalog:${card.id}`);
          onDragStart?.(card);
        }}
        onDragEnd={() => onDragEnd?.()}
        onClick={() => onAdd(card)}
        className="group relative z-10 block w-full cursor-pointer rounded-xl border border-transparent text-left transition-colors hover:border-border/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="relative aspect-[488/680] w-full overflow-visible">
          <div
            data-card-art-frame="primary"
            className="db-card-shadow absolute inset-0 overflow-hidden rounded-xl bg-transparent"
          >
            <CardArt
              card={card}
              sizes="(max-width: 640px) 50vw, (max-width: 1919px) 16.5rem, 19rem"
              className="h-full w-full object-cover"
            />
          </div>
          {banned ? (
            <span className="absolute left-2 top-2 z-10 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
              Banned
            </span>
          ) : null}
          {deckCount > 0 ? (
            <span
              aria-label={`${deckCount} in deck`}
              className="absolute right-2 top-2 z-10 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#0c121c] px-1.5 text-xs font-bold text-white shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
            >
              x{deckCount}
            </span>
          ) : null}
        </div>
      </button>

      <div
        data-deck-workspace-mobile-actions={card.id}
        className="db-card-actions mx-px -mt-[11px] flex h-[42px] items-center justify-evenly rounded-b-xl bg-[#0c121c] pt-[10px] text-white/75 shadow-[0_8px_18px_rgba(9,10,19,0.22)] lg:bg-transparent lg:shadow-none"
      >
        <button
          type="button"
          aria-label={T.addCardToSection(card.name, "selected section")}
          onClick={() => onAdd(card)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
        >
          <BuilderIcon name="plus" className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={bookmarked ? T.removeBookmark(card.name) : T.bookmarkCard(card.name)}
          aria-pressed={bookmarked}
          data-deck-workspace-bookmark-toggle-mobile={card.id}
          onClick={() => onToggleBookmark(card)}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-white/10 hover:text-white lg:hidden ${
            bookmarked ? "text-[#f3d27a]" : "text-white/75"
          }`}
        >
          <BuilderIcon name="bookmark" className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={bookmarked ? T.removeBookmark(card.name) : T.bookmarkCard(card.name)}
          aria-pressed={bookmarked}
          data-deck-workspace-bookmark-toggle={card.id}
          onClick={() => onToggleBookmark(card)}
          className={`db-desktop-only db-bookmark-ribbon absolute right-2 top-0 z-20 flex h-8 w-5 items-start justify-center pt-1.5 text-[10px] font-bold shadow-sm transition-opacity ${
            bookmarked ? "opacity-100" : "opacity-0 group-hover/catalog-card:opacity-100"
          } ${bookmarked ? "bg-[linear-gradient(180deg,#f3d27a,#c89e3d)] text-[#2a2109]" : "text-[#25272f]"}`}
        >
          <BuilderIcon name="bookmark" className="h-3 w-3" />
        </button>
        <div
          data-deck-workspace-details-anchor={card.id}
          className="lg:pointer-events-none lg:absolute lg:bottom-2 lg:right-2 lg:z-10"
        >
          <button
            type="button"
            aria-label={T.viewDetailsFor(card.name)}
            data-deck-workspace-details-trigger={card.id}
            onClick={() => onViewDetails(card)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white lg:pointer-events-auto lg:h-6 lg:w-6 lg:rounded lg:bg-black/45 lg:text-white/85 lg:opacity-0 lg:backdrop-blur group-hover/catalog-card:lg:opacity-100"
          >
            <BuilderIcon name="expand" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}
