"use client";

import type { CardInstance, PlayerBoard, RoomPlayer } from "@rift/protocol";

import type { CardEventHandler, CardSide } from "../card/types";
import { GameCard } from "../card/GameCard";
import { GameCardFace } from "../card/GameCardFace";
import { HandSlot } from "../interaction/HandSlot";
import { useBoardInteractionOptional } from "../interaction/context";
import { BaseZone, RuneArea } from "../zones/ZoneRails";
import { HandFan } from "../zones/HandFan";
import { Pile } from "../zones/Pile";
import { FloatingResources } from "../zones/FloatingResources";

const PLAYER_LAYER_CLASS =
  "gb-board-layer absolute h-(--player-band-size) py-[0.22rem] grid grid-cols-[var(--rune-play-width)_minmax(0,1.5fr)_var(--player-action-column-width)_var(--player-lane-column-width)_var(--player-lane-column-width)] gap-x-[0.16rem] gap-y-(--player-board-row-gap) z-8 overflow-visible pointer-events-none [--player-layer-inline-pad:0.16rem] [--deck-hand-shelf-lift:0.5rem] [--rune-deck-edge-lift:0.5rem] [--rune-play-width:calc(var(--card-width)*5.45)] [--left-lanes-x:calc(var(--battlefield-side-gap)-var(--player-layer-inline-pad))] [--player-lane-column-width:calc(var(--card-width)*1.153846)] [--player-action-column-width:max(calc(var(--card-width)*1.153846),7.05rem)] [--player-board-row-gap:clamp(0.32rem,calc(var(--card-width)*0.075),0.58rem)] [--wide-board-extra:max(0,calc(var(--board-scale)-1))] [--wide-legend-base-clearance:min(calc(var(--card-width)*var(--wide-board-extra)*0.55),calc(var(--board-right-safety-gutter)*0.72))] [--base-legend-clearance:max(0rem,calc(var(--left-lanes-x)-var(--lane-left-x)))] [--right-lane-main-gap-offset:calc(var(--card-width)*0.04)] [--right-lane-side-gap-offset:calc(var(--card-width)*0.12)] [--lane-left-x:calc(var(--card-width)*1.175)] [--lane-right-main-x:calc(var(--card-width)*0.03+var(--wide-legend-base-clearance)-var(--right-lane-main-gap-offset))] [--lane-right-side-x:calc(var(--card-width)*-0.086538+var(--wide-legend-base-clearance)+var(--right-lane-side-gap-offset))] [--lane-row-gap-y:clamp(0.46rem,calc(var(--card-width)*0.09),0.7rem)] [--lane-front-natural-y:calc(var(--card-width)*0.682692)] [--lane-pile-natural-y:clamp(calc(var(--card-width)*0.42),calc(var(--card-width)*1.211538-3.1dvh),calc(var(--card-width)*0.846154))] [--lane-pile-viewport-max:clamp(0rem,calc(8dvh+0.38rem-env(safe-area-inset-bottom)),calc(8dvh+0.38rem))] [--lane-pile-y:min(var(--lane-pile-natural-y),var(--lane-pile-viewport-max))] [--lane-front-y:min(var(--lane-front-natural-y),max(0rem,calc(var(--lane-pile-y)-var(--lane-row-gap-y))))] [--rune-deck-lane-y:calc(var(--lane-pile-y)+clamp(0.22rem,calc(var(--card-width)*0.055),0.42rem))] [--hand-left-inset:calc(var(--rune-deck-lane-x)+(var(--card-width)*2.34)+(var(--card-width)*0.057692))] [--hand-right-inset:calc(var(--card-width)*3.653846)] grid-rows-[minmax(0,1.25fr)_minmax(0,1.25fr)_minmax(0,0.5fr)] [grid-template-areas:'leftLanes_leftLanes_._legend_champion'_'runeDeck_._deckHand_main_trash'_'hand_hand_hand_hand_hand']";

const AREA_CLASS = {
  leftLanes:
    "[grid-area:leftLanes] min-h-0 min-w-0 mr-(--base-legend-clearance) grid grid-cols-[minmax(0,9fr)_minmax(0,11fr)] gap-[0.16rem]",
  runeDeck:
    "[grid-area:runeDeck] min-h-0 w-fit self-end transform-[translate(var(--rune-deck-lane-x),calc(var(--rune-deck-lane-y)-var(--rune-deck-edge-lift)))] pointer-events-none",
  legend:
    "[grid-area:legend] min-h-0 flex items-end justify-end transform-[translate(var(--lane-right-main-x),var(--hero-lane-y,var(--lane-front-y)))] pointer-events-auto overflow-visible",
  champion:
    "[grid-area:champion] min-h-0 flex items-end justify-end transform-[translate(var(--lane-right-side-x),var(--hero-lane-y,var(--lane-front-y)))] pointer-events-auto overflow-visible",
  main:
    "[grid-area:main] min-h-0 relative z-130 flex items-start justify-end place-self-end transform-[translate(var(--lane-right-main-x),calc(var(--lane-pile-y)-var(--deck-hand-shelf-lift)))] pointer-events-auto",
  trash:
    "[grid-area:trash] min-h-0 place-self-end transform-[translate(var(--lane-right-side-x),var(--lane-pile-y))] pointer-events-auto",
  hand:
    "[grid-area:hand] z-9 min-h-0 absolute left-(--hand-left-inset) right-(--hand-right-inset) bottom-[calc(-0.22rem+var(--deck-hand-shelf-lift))] overflow-visible pointer-events-none",
} as const;

/** Engraved empty slot: dashed rune outline, corner ticks and a small zone label. */
function EmptyZoneCard({ label, mirrored = false }: { label: string; mirrored?: boolean }) {
  return (
    <div
      data-empty-zone-slot="true"
      aria-label={label}
      className="empty-slot w-(--card-width) rounded-(--card-radius-tight) min-h-(--card-height)"
    >
      <svg aria-hidden="true" viewBox="0 0 40 56" preserveAspectRatio="xMidYMid meet" className="empty-slot-sigil">
        <path d="M20 10 L25 28 L20 46 L15 28 Z" />
        <path d="M8 28 L20 24 L32 28 L20 32 Z" />
        <circle cx="20" cy="28" r="12" strokeDasharray="1.5 2.5" />
      </svg>
      <span className={"empty-slot-label" + (mirrored ? " rotate-180 origin-center" : "")}>{label}</span>
    </div>
  );
}

function CardZone({
  cards,
  zone,
  owner,
  onCardEvent,
  selectedCardIds,
  targetableCardIds,
  collapsed = false,
}: {
  cards: CardInstance[];
  zone: "legend" | "champion";
  owner: CardSide;
  onCardEvent?: CardEventHandler;
  selectedCardIds?: ReadonlySet<string>;
  targetableCardIds?: ReadonlySet<string>;
  collapsed?: boolean;
}) {
  if (cards.length === 0) {
    return <EmptyZoneCard label={collapsed ? "…" : zone === "legend" ? "Legend" : "Champion"} mirrored={owner === "opponent"} />;
  }
  return (
    <div className="flex items-end justify-end overflow-visible gap-[0.1rem]">
      {cards.map((card) => (
        <GameCard
          key={card.id}
          card={card}
          zone={zone}
          owner={owner}
          profile="board"
          exhausted={card.exhausted}
          faceDown={card.hidden}
          labels={card.customLabels}
          readOnly={!onCardEvent}
          onCardEvent={onCardEvent}
          selected={selectedCardIds?.has(card.id)}
          targetable={targetableCardIds?.has(card.id)}
        />
      ))}
    </div>
  );
}

/**
 * Trash and banished are public zones (R108/R109): the top card is always face up. Clicks bubble
 * to the pile section (which opens the pile viewer) and hovering shows the card preview.
 */
function PileTopCard({
  card,
  owner,
  slot,
}: {
  card: CardInstance;
  owner: CardSide;
  slot: "trash" | "banished";
}) {
  const interaction = useBoardInteractionOptional();
  return (
    <div
      data-pile-top-card={slot}
      data-pile-owner={owner}
      data-card-id={card.id}
      data-card-code={card.cardCode}
      className="relative w-(--card-width) h-(--card-height) overflow-hidden rounded-(--card-radius-main) border border-[rgba(165,184,207,0.3)] bg-[rgba(8,18,32,0.6)] shadow-[0_6px_16px_rgba(3,8,20,0.45)]"
      onPointerEnter={(event) => interaction?.showCardPreview(card, event.currentTarget)}
      onPointerLeave={() => interaction?.hideCardPreview()}
    >
      <GameCardFace
        card={card}
        profile="board"
        mirrored={owner === "opponent"}
        side={owner}
      />
    </div>
  );
}

export interface PlayerLayerProps {
  player: RoomPlayer;
  board: PlayerBoard;
  side: CardSide;
  handRevealed?: boolean;
  opponentHandRevealed?: boolean;
  onCardEvent?: CardEventHandler;
  handSlot?: React.ReactNode;
  cardWidthRem?: number;
  autoPayPreviewCardIds?: Set<string>;
  selectedCardIds?: Set<string>;
  targetableCardIds?: Set<string>;
  touchLayout?: boolean;
}

export function PlayerLayer({
  player,
  board,
  side,
  handRevealed = false,
  opponentHandRevealed = false,
  onCardEvent,
  handSlot,
  cardWidthRem = 5.2,
  selectedCardIds,
  targetableCardIds,
  touchLayout = false,
}: PlayerLayerProps) {
  const opponent = side === "opponent";
  const interaction = useBoardInteractionOptional();
  const topTrash = board.trash?.at(-1) ?? null;
  const topBanished = board.banished?.at(-1) ?? null;
  const effectiveCardHandler = onCardEvent ?? interaction?.handleCardEvent;
  const allHandCardsRevealed =
    (board.hand ?? []).length > 0 && (board.hand ?? []).every((card) => !!card.revealedToOpponent);
  const actualHandRevealed =
    (side === "self"
      ? handRevealed || !!board.handRevealToOpponent
      : opponentHandRevealed ||
        !!board.handRevealToOpponent ||
        !!board.handRevealedToPlayerIds?.includes(interaction?.viewerId ?? "")) ||
    allHandCardsRevealed;
  const positionClass = opponent
    ? "top-0 left-(--board-right-safety-gutter) right-0 px-(--player-layer-inline-pad) rotate-180 origin-center"
    : "bottom-[var(--local-player-layer-bottom-inset,0rem)] left-0 right-(--board-right-safety-gutter) px-(--player-layer-inline-pad)";
  const runeDeckNudge = opponent
    ? "var(--identity-badge-opponent-nudge, 0rem)"
    : "var(--identity-badge-player-nudge, 0rem)";

  return (
    <section
      data-player-layer={side}
      data-touch-layout={touchLayout ? "true" : "false"}
      data-board-drag-active="false"
      data-buff-action-armed="false"
      className={`${PLAYER_LAYER_CLASS} ${positionClass}`}
      style={{
        ["--rune-deck-lane-x" as string]: `max(var(--lane-left-x), calc(var(--track-edge-inset) + var(--score-track-rail-width) / 2 + var(--identity-badge-width) / 2 + ${runeDeckNudge} + var(--score-track-lane-clearance)))`,
      }}
    >
      <div data-player-area="leftLanes" className={AREA_CLASS.leftLanes}>
        <div className="relative min-h-0 min-w-0 w-full transform-[translate(var(--left-lanes-x),var(--lane-front-y))] pointer-events-auto">
          <RuneArea
            owner={side}
            runes={board.runeArea ?? []}
            onCardEvent={effectiveCardHandler}
            selectedCardIds={selectedCardIds}
            targetableCardIds={targetableCardIds}
          />
        </div>
        <BaseZone
          owner={side}
          cards={board.base ?? []}
          onCardEvent={effectiveCardHandler}
          selectedCardIds={selectedCardIds}
          targetableCardIds={targetableCardIds}
        />
      </div>

      <div data-player-area="runeDeck" className={AREA_CLASS.runeDeck}>
        <div className="grid grid-cols-[auto_var(--card-width)] items-end gap-x-[0.14rem] gap-y-[0.12rem]">
          <div className="tablet-rune-pile pointer-events-auto col-start-1 row-start-1 row-span-3">
            <Pile
              slot="runeDeck"
              owner={side}
              count={board.runeDeck?.length ?? 0}
              label="Rune Deck"
              cardBackSlot="runeDeck"
              counterUpright={opponent}
              topCard={board.runeDeck?.at(-1) ?? null}
            />
          </div>
          <FloatingResources
            owner={side}
            energy={board.floatingEnergy ?? 0}
            power={board.floatingPower ?? 0}
            interactive={!opponent}
          />
        </div>
      </div>

      <div data-player-area="main" className={AREA_CLASS.main}>
        <div className="flex items-start justify-end gap-[0.18rem]">
          <Pile
            slot="mainDeck"
            owner={side}
            count={board.deck?.length ?? 0}
            label="Main Deck"
            cardBackSlot="deck"
            counterUpright={opponent}
            topCard={board.deck?.at(-1) ?? null}
          />
        </div>
      </div>

      <div data-player-area="hand" className={AREA_CLASS.hand}>
        {actualHandRevealed ? (
          <div
            className={
              "pointer-events-none absolute left-1/2 bottom-[calc(100%+0.3rem)] z-60 inline-flex -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-[0.16rem] border border-[rgba(105,200,230,0.55)] bg-[rgba(9,25,45,0.94)] px-[0.62rem] py-[0.16rem] text-[0.62rem] font-bold uppercase tracking-[0.09em] text-[#bfeaff] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_16px_rgba(2,7,18,0.5)]" +
              (side === "opponent" ? " rotate-180 origin-center" : "")
            }
          >
            {side === "opponent" ? "OPPONENT HAND REVEALED" : "HAND REVEALED"}
          </div>
        ) : null}
        {side === "self" && handSlot ? (
          <div className="w-full min-h-0 border-none bg-transparent p-0 flex items-end justify-center shadow-none pointer-events-auto">
            {handSlot}
          </div>
        ) : interaction ? (
          <HandSlot {...interaction.slotProps} owner={side} />
        ) : (
          <HandFan
            cards={board.hand ?? []}
            owner={side}
            faceDown={opponent}
            layoutCardWidthRem={cardWidthRem}
            onCardEvent={effectiveCardHandler}
          />
        )}
      </div>

      <div data-player-area="trash" className={AREA_CLASS.trash}>
        <div className="relative">
          <section
            data-drop-zone-root="trash"
            data-zone-owner={side}
            data-stack-presentation="standard"
            data-stack-depth="0"
            data-stack-top-card-centered="false"
            className="relative h-full min-h-0 rounded-[0.08rem] border-none bg-transparent p-[0.08rem] flex items-center justify-center shadow-none overflow-visible after:content-[''] after:absolute after:inset-[0.08rem] after:pointer-events-none after:opacity-[0.24] after:gb-ornament-pile"
            {...interaction?.getDropZoneHandlers("trash", side)}
            onClick={(event) => {
              event.stopPropagation();
              interaction?.handlePilePress("trash", side, event);
            }}
            onContextMenu={(event) => {
              if (event.shiftKey) return;
              event.preventDefault();
              event.stopPropagation();
              interaction?.handlePileContextMenu("trash", side, event);
            }}
          >
            <div
              data-pile-count-placement="top-right"
              className={
                "absolute z-30 right-[0.18rem] top-[0.12rem]" +
                (opponent ? " rotate-180 origin-center" : "")
              }
            >
              <strong data-pile-counter="true" className="z-30 pointer-events-none leading-none [font-variant-numeric:tabular-nums] rounded-[0.36rem] border border-[rgba(220,236,255,0.24)] bg-[linear-gradient(180deg,rgba(60,86,120,0.24)_0%,rgba(11,19,33,0.52)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_0_0_1px_rgba(240,247,255,0.05),0_4px_14px_rgba(4,10,21,0.34)] backdrop-blur-md backdrop-saturate-150 text-[#f7fbff] text-[1.38rem] font-black tracking-[-0.03em] px-[0.34rem] py-[0.1rem]">
                <span className="[text-shadow:0_2px_0_rgba(0,0,0,0.98),0_0_8px_rgba(0,0,0,0.88),0_0_14px_rgba(4,11,28,0.7)]">
                  {board.trash?.length ?? 0}
                </span>
              </strong>
            </div>
            <div
              data-zone-rail="trash"
              data-zone-owner={side}
              className="min-h-0 relative flex items-center justify-center h-full w-full overflow-visible pb-0"
            >
              <div
                className="relative flex items-center justify-center"
                style={{
                  width: "calc(var(--card-width) + 0.56rem * var(--pile-stack-spread-scale, 1))",
                  height: "calc(var(--card-height) + 0.56rem * var(--pile-stack-spread-scale, 1))",
                }}
              >
                {topTrash ? (
                  <PileTopCard card={topTrash} owner={side} slot="trash" />
                ) : (
                  <div
                    className="relative"
                    aria-hidden="true"
                    style={{
                      width: "calc(var(--card-width) + 0.56rem * var(--pile-stack-spread-scale, 1))",
                      height: "calc(var(--card-height) + 0.56rem * var(--pile-stack-spread-scale, 1))",
                    }}
                  />
                )}
              </div>
            </div>
          </section>
          <button
            type="button"
            data-banished-pile-button="true"
            data-pile-slot="banished"
            data-pile-owner={side}
            data-pile-count={board.banished?.length ?? 0}
            className={
              "absolute -bottom-[1.28rem] right-0 z-30 inline-flex items-center gap-[0.16rem] rounded-[0.18rem] border border-[rgba(192,176,244,0.3)] bg-[rgba(35,28,58,0.9)] px-[0.3rem] py-[0.1rem] text-[0.5rem] font-bold uppercase tracking-[0.05em] text-[#e4dcff] shadow-[0_4px_10px_rgba(3,8,20,0.4)] hover:bg-[rgba(43,34,69,0.95)]" +
              (opponent ? " rotate-180 origin-center" : "")
            }
            aria-label={`Banished pile, ${board.banished?.length ?? 0} cards`}
            onClick={(event) => {
              event.stopPropagation();
              interaction?.handlePilePress("banished", side, event);
            }}
            onContextMenu={(event) => {
              if (event.shiftKey) return;
              event.preventDefault();
              event.stopPropagation();
              interaction?.handlePileContextMenu("banished", side, event);
            }}
          >
            {topBanished ? (
              <span
                data-pile-top-card="banished"
                data-pile-owner={side}
                data-card-id={topBanished.id}
                data-card-code={topBanished.cardCode}
                className="relative h-[1.35rem] w-[0.97rem] shrink-0 overflow-hidden rounded-[0.08rem] border border-[rgba(192,176,244,0.42)] bg-[rgba(12,10,22,0.72)]"
                onPointerEnter={(event) => interaction?.showCardPreview(topBanished, event.currentTarget)}
                onPointerLeave={() => interaction?.hideCardPreview()}
              >
                <GameCardFace
                  card={topBanished}
                  profile="thumb"
                  mirrored={opponent}
                  side={side}
                />
              </span>
            ) : (
              <span aria-hidden="true">◈</span>
            )}
            <span>{board.banished?.length ?? 0}</span>
          </button>
        </div>
      </div>

      <div data-player-area="legend" className={AREA_CLASS.legend}>
        <div className="gb-neeko-legend-stack relative isolate">
          <div className="gb-neeko-starting-legend relative">
            <section
              data-zone-owner={side}
              data-drop-zone-root="legend"
              className="relative w-full max-w-(--card-width) min-w-0 rounded-none border-none bg-transparent p-0 flex items-center justify-center overflow-visible"
              {...interaction?.getDropZoneHandlers("legend", side)}
            >
              <CardZone
                cards={(board.legend ?? []).slice(0, 1)}
                zone="legend"
                owner={side}
                onCardEvent={effectiveCardHandler}
                selectedCardIds={selectedCardIds}
                targetableCardIds={targetableCardIds}
              />
            </section>
          </div>
        </div>
      </div>

      <div data-player-area="champion" className={AREA_CLASS.champion}>
        <section
          data-zone-owner={side}
          data-drop-zone-root="champion"
          className="relative w-full max-w-(--card-width) min-w-0 rounded-none border-none bg-transparent p-0 flex items-center justify-center overflow-visible"
          {...interaction?.getDropZoneHandlers("champion", side)}
        >
          <CardZone
            cards={board.champion ?? []}
            zone="champion"
            owner={side}
            onCardEvent={effectiveCardHandler}
            selectedCardIds={selectedCardIds}
            targetableCardIds={targetableCardIds}
          />
        </section>
      </div>
    </section>
  );
}
