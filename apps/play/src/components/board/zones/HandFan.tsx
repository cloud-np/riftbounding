"use client";

import type { CardInstance } from "@rift/protocol";

import { computeHandFan } from "../layout/board-metrics";
import { GameCard } from "../card/GameCard";
import type { CardEventHandler, CardSide } from "../card/types";

export const HAND_FAN_SLOT_CLASS =
  "group handFanSlot hand-slot pointer-events-auto absolute left-1/2 top-0 z-0 flex items-start w-(--card-width) h-(--card-height) origin-[center_bottom] transform-[translate(calc(-50%+var(--fan-offset-x,0rem)),calc(var(--fan-translate-y,0px)+var(--fan-hover-raise,0px)))_rotate(var(--fan-rotate,0deg))] transition-transform duration-300 ease-[cubic-bezier(0.22,0.8,0.3,1)] motion-reduce:transition-none group-hover:z-80 group-focus-within:z-80";

export interface HandFanProps {
  cards: CardInstance[];
  owner: CardSide;
  faceDown?: boolean;
  revealed?: boolean;
  layoutCardWidthRem?: number;
  railWidthRem?: number;
  maxRailWidthRem?: number;
  onCardEvent?: CardEventHandler;
  onHoverCard?: (cardId: string | null) => void;
  hoveredCardId?: string | null;
}

/** Hand fan powered by the original `793143 l` geometry. */
export function HandFan({
  cards,
  owner,
  faceDown = false,
  revealed = false,
  layoutCardWidthRem = 5.2,
  railWidthRem,
  maxRailWidthRem,
  onCardEvent,
  onHoverCard,
  hoveredCardId = null,
}: HandFanProps) {
  const fan = computeHandFan({
    cards,
    layoutCardWidthRem,
    railWidthRem,
    maxRailWidthRem,
    remoteHoveredCardId: hoveredCardId,
  });

  return (
    <section
      data-drop-zone-root="hand"
      data-zone-owner={owner}
      className="min-h-0 border-none bg-transparent p-0 flex items-end justify-center shadow-none pointer-events-auto"
    >
      <div
        className="handRail min-h-0 min-w-0 relative block w-full h-(--card-height) overflow-visible p-0 rounded-none"
        data-hand-drag-active="false"
        data-zone-owner={owner}
        data-hand-fan-presentation="standard"
        style={fan.railStyle}
      >
        <div className="pointer-events-none absolute inset-0 z-40 overflow-visible">
          {fan.slots.map((slot) => {
            const card = slot.card as CardInstance;
            return (
              <div
                key={card.id}
                className={HAND_FAN_SLOT_CLASS}
                style={slot.style}
                data-card-id={card.id}
                onPointerEnter={() => onHoverCard?.(card.id)}
                onPointerLeave={() => onHoverCard?.(null)}
              >
                <div
                  className="relative w-full h-full"
                  data-hover-preview-anchor="true"
                  data-preview-landscape="false"
                  data-preview-rotation="0"
                  data-card-id={card.id}
                  data-drop-zone="hand"
                >
                  <GameCard
                    card={card}
                    zone="hand"
                    owner={owner}
                    profile="hand"
                    faceDown={faceDown && !revealed}
                    exhausted={false}
                    labels={card.customLabels}
                    readOnly={!onCardEvent}
                    onCardEvent={onCardEvent}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
