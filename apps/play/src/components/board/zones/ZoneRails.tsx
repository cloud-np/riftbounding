"use client";

import type { CardInstance } from "@rift/protocol";

import { GameCard } from "../card/GameCard";
import { attachedFanWidth, groupAttachedCards } from "../card/attachments";
import type { CardEventHandler, CardSide } from "../card/types";
import { useBoardInteractionOptional } from "../interaction/context";
import { TokenPanel } from "../tokens/TokenPanel";

const ZONE_SECTION_CLASS =
  "relative min-h-0 h-full rounded-[0.08rem] border-none bg-transparent py-[0.2rem] px-[0.22rem] flex flex-col gap-[0.14rem] shadow-none after:content-[''] after:absolute after:inset-[0.08rem] after:pointer-events-none after:opacity-[0.6] after:gb-ornament-zone";

const HEADER_CLASS =
  "flex justify-between items-baseline gap-[0.34rem] [&_h4]:text-[#e1e3e9] [&_h4]:text-(length:--zone-label-size) [&_h4]:leading-[1.2] [&_h4]:tracking-[0.03em] [&_h4]:uppercase [&_h4]:text-shadow-none";

/**
 * Slot around each rail card. Slots may shrink below the card width (the card itself keeps its
 * size and overflows visibly), so a crowded rail fans its cards into an overlapping stack that
 * stays inside its own column instead of spilling into the neighbouring zone. The last card never
 * shrinks so it is always shown in full.
 */
const RAIL_SLOT_CLASS = "relative min-w-0 shrink basis-(--card-width) last:shrink-0";

export function RuneArea({
  owner,
  runes,
  onCardEvent,
  selectedCardIds,
  targetableCardIds,
}: {
  owner: CardSide;
  runes: CardInstance[];
  onCardEvent?: CardEventHandler;
  selectedCardIds?: ReadonlySet<string>;
  targetableCardIds?: ReadonlySet<string>;
}) {
  const ready = runes.filter((rune) => !rune.exhausted).length;
  const total = runes.length;
  const mirrored = owner === "opponent";
  const interaction = useBoardInteractionOptional();
  const dropHandlers = interaction?.getDropZoneHandlers("runeArea", owner);

  return (
    <section
      data-drop-zone-root="runeArea"
      data-zone-owner={owner}
      className={ZONE_SECTION_CLASS}
      {...dropHandlers}
      onContextMenu={(event) => {
        if (event.shiftKey) return;
        event.preventDefault();
        event.stopPropagation();
        interaction?.handleZoneContextMenu("runeArea", owner, event);
      }}
    >
      <div className={HEADER_CLASS + (mirrored ? " rotate-180 origin-center" : "")}>
        <span
          role="status"
          data-rune-ready-count={ready}
          data-rune-used-count={total - ready}
          className="text-[#b0b5c1] ml-auto text-(length:--rune-zone-count-size) font-semibold"
          aria-label={`${ready} ready runes out of ${total}`}
        >
          {ready}/{total}
        </span>
      </div>
      <div
        data-zone-rail="runeArea"
        data-zone-owner={owner}
        className="min-h-0 relative flex justify-start items-center flex-1 overflow-visible pb-0 gap-[0.14rem]"
      >
        {runes.length === 0 ? (
          <div
            className="w-(--card-width) min-w-(--card-width) h-(--card-height) min-h-(--card-height) pointer-events-none"
            aria-hidden="true"
          />
        ) : (
          runes.map((rune) => (
            <div key={rune.id} className={RAIL_SLOT_CLASS}>
              <GameCard
                key={rune.id}
                card={rune}
                zone="runeArea"
                owner={owner}
                profile="board"
                exhausted={rune.exhausted}
                readOnly={!onCardEvent}
                labels={rune.customLabels}
                onCardEvent={onCardEvent}
                selected={selectedCardIds?.has(rune.id)}
                targetable={targetableCardIds?.has(rune.id)}
              />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function BaseZone({
  owner,
  cards,
  onCardEvent,
  selectedCardIds,
  targetableCardIds,
}: {
  owner: CardSide;
  cards: CardInstance[];
  onCardEvent?: CardEventHandler;
  selectedCardIds?: ReadonlySet<string>;
  targetableCardIds?: ReadonlySet<string>;
}) {
  const mirrored = owner === "opponent";
  const interaction = useBoardInteractionOptional();
  const dropHandlers = interaction?.getDropZoneHandlers("base", owner);
  const { topLevel, byHostId } = groupAttachedCards(cards);
  return (
    <div className="gb-base-lane min-h-0 min-w-0 relative transform-[translate(var(--left-lanes-x),var(--lane-front-y))] pointer-events-auto">
      <section
        data-drop-zone-root="base"
        data-zone-owner={owner}
        className={ZONE_SECTION_CLASS}
        {...dropHandlers}
      >
        <div
          className="absolute inset-0 z-1 rounded-[0.08rem] border border-transparent bg-transparent transition-[background-color,border-color,box-shadow] duration-150 pointer-events-none"
          data-card-id={`base-area-marker:${owner === "self" ? "self" : "opponent"}`}
          data-drop-zone="base"
          data-target-anchor="board"
          data-base-area-marker="true"
          role="img"
          aria-label={owner === "self" ? "Your base area" : "Opponent base area"}
        />
        <div className="absolute right-[0.18rem] top-[0.16rem] z-40">
          <TokenPanel zone="base" owner={owner} />
        </div>
        <div className={HEADER_CLASS + (mirrored ? " rotate-180 origin-center" : "")}>
          <span role="status" className="text-[#b0b5c1] ml-auto text-(length:--zone-count-size)">
            {cards.length}
          </span>
        </div>
        <div
          data-zone-rail="base"
          data-zone-owner={owner}
          className="min-h-0 relative flex items-center flex-1 overflow-visible pb-0 justify-start! gap-[0.14rem]"
          style={{ ["--card-counter-density-scale" as string]: 1 }}
        >
          {cards.length === 0 ? (
            <div
              className="w-(--card-width) min-w-(--card-width) h-(--card-height) min-h-(--card-height) pointer-events-none"
              aria-hidden="true"
            />
          ) : (
            topLevel.map((card) => {
              const attachedCards = byHostId.get(card.id) ?? [];
              const slotWidth = attachedFanWidth(attachedCards.length);
              return (
                <div
                  key={card.id}
                  className={RAIL_SLOT_CLASS}
                  style={{ flexBasis: slotWidth, width: slotWidth }}
                >
                  <GameCard
                    key={card.id}
                    card={card}
                    zone="base"
                    owner={owner}
                    profile="board"
                    exhausted={card.exhausted}
                    faceDown={card.hidden || card.isPlaceholder}
                    labels={card.customLabels}
                    attachedCards={attachedCards}
                    onCardEvent={onCardEvent}
                    readOnly={!onCardEvent}
                    selected={selectedCardIds?.has(card.id)}
                    targetable={targetableCardIds?.has(card.id)}
                  />
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
