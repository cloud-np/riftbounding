"use client";

import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

import type { CardInstance, Zone } from "@rift/protocol";

import { useBoardInteractionOptional } from "../interaction/context";
import { attachedCardOffset, attachedFanZIndex } from "./attachments";
import { CardArt } from "./CardArt";
import { CardBack } from "./CardBack";
import type { CardEvent, CardEventHandler, CardSide } from "./types";

type AttachedPointerEvent =
  | ReactMouseEvent<HTMLElement>
  | ReactPointerEvent<HTMLElement>
  | ReactKeyboardEvent<HTMLElement>;

/** Build the same board card event shape the host card emits, for one attached gear. */
export function buildAttachedCardEvent(input: {
  type: CardEvent["type"];
  card: CardInstance;
  zone: Zone;
  owner: CardSide;
  event?: AttachedPointerEvent;
  anchorRect?: CardEvent["anchorRect"];
}): CardEvent {
  const element = input.event?.currentTarget;
  const rect = element?.getBoundingClientRect?.();
  const anchorRect =
    input.anchorRect ??
    (rect
      ? {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        }
      : undefined);
  return {
    type: input.type,
    card: input.card,
    zone: input.zone,
    owner: input.owner,
    exhausted: !!input.card.exhausted,
    faceDown: !!input.card.hidden,
    clientX: input.event && "clientX" in input.event ? input.event.clientX : undefined,
    clientY: input.event && "clientY" in input.event ? input.event.clientY : undefined,
    pointerType:
      input.event && "pointerType" in input.event
        ? (input.event as ReactPointerEvent<HTMLElement>).pointerType
        : undefined,
    shiftKey: input.event?.shiftKey,
    ctrlKey: input.event?.ctrlKey,
    metaKey: input.event?.metaKey,
    altKey: input.event?.altKey,
    ...(anchorRect ? { anchorRect } : {}),
  };
}

export interface AttachedCardFanProps {
  cards: CardInstance[];
  zone: Zone;
  owner: CardSide;
  onCardEvent?: CardEventHandler;
}

/**
 * The reference attached-equipment fan: gear sits behind its unit at the same size and height,
 * offset right by {@link ATTACHED_FAN_STEP} of a card width each. The unit stays on top and the
 * first attached gear stays above later gear, so every card shows its own right-hand strip.
 */
export function AttachedCardFan({ cards, zone, owner, onCardEvent }: AttachedCardFanProps) {
  const interaction = useBoardInteractionOptional();
  const handler = onCardEvent ?? interaction?.handleCardEvent;

  if (cards.length === 0) return null;

  const emit = (
    attachedCard: CardInstance,
    type: CardEvent["type"],
    event: AttachedPointerEvent,
  ) => {
    if (!handler) return;
    handler(buildAttachedCardEvent({ type, card: attachedCard, zone, owner, event }));
  };

  return (
    <div
      data-attached-card-fan="true"
      data-attached-card-count={cards.length}
      className="pointer-events-none absolute left-0 top-0"
      style={{ width: "var(--card-width)", height: "var(--card-height)" }}
    >
      {cards.map((attachedCard, index) => {
        const faceDown = attachedCard.hidden || attachedCard.isPlaceholder || !attachedCard.name;
        const promptOption = !!interaction?.strictPromptOptionIds.has(attachedCard.id);
        const promptHovered = interaction?.strictPromptHoverId === attachedCard.id;
        const zIndex = attachedFanZIndex(index, cards.length);
        return (
          <div
            key={`attached-${attachedCard.id}`}
            aria-hidden={promptOption ? undefined : "true"}
            data-attached-card-id={attachedCard.id}
            data-attached-card-rank={index}
            data-attached-card-z={zIndex}
            data-attached-card-name={faceDown ? undefined : attachedCard.name}
            data-strict-prompt-option={promptOption ? "true" : undefined}
            data-strict-prompt-hover={promptHovered ? "true" : undefined}
            role={promptOption ? "button" : undefined}
            tabIndex={promptOption ? 0 : undefined}
            className={`pointer-events-auto absolute overflow-hidden rounded-(--card-radius-main) border border-[rgba(165,184,207,0.22)] bg-[rgba(24,43,64,0.95)] shadow-[0_4px_10px_rgba(3,8,20,0.42)] ${
              promptOption ? "cursor-pointer" : ""
            }`}
            style={{
              left: attachedCardOffset(index),
              top: 0,
              width: "var(--card-width)",
              height: "var(--card-height)",
              zIndex,
            }}
            onPointerEnter={(event) => {
              if (event.pointerType && event.pointerType !== "mouse") return;
              emit(attachedCard, "hover", event);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType && event.pointerType !== "mouse") return;
              emit(attachedCard, "hoverEnd", event);
            }}
            onClick={(event) => {
              if (!promptOption) return;
              event.preventDefault();
              event.stopPropagation();
              emit(attachedCard, "select", event);
            }}
            onKeyDown={(event) => {
              if (!promptOption) return;
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              emit(attachedCard, "select", event);
            }}
          >
            {faceDown ? (
              <CardBack slot="deck" insetPx={0} label={attachedCard.name || undefined} side={owner} />
            ) : (
              <CardArt
                card={attachedCard}
                profile="board"
                side={owner}
                className="pointer-events-none h-full w-full select-none object-contain"
                alt={attachedCard.name}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
