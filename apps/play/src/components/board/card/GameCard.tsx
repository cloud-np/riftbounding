"use client";

import type { CSSProperties, MouseEvent, PointerEvent as ReactPointerEvent, DragEvent as ReactDragEvent } from "react";
import { useMemo, useRef } from "react";

import type { CardInstance, Zone } from "@rift/protocol";

import type { CardImageProfile } from "@/lib/assets";

import { useBoardInteractionOptional } from "../interaction/context";
import type { GameActionIntent } from "../slot-types";
import { AttachedCardFan } from "./AttachedCardFan";
import { attachedFanWidth } from "./attachments";
import { CardActionButtons } from "./CardActionButtons";
import { CardBack } from "./CardBack";
import { CardLabelStack } from "./CardLabelStack";
import { GameCardFace } from "./GameCardFace";
import { CardTokenFace } from "./CardTokenFace";
import { cardMeta, currentMight } from "./card-meta";
import { domainStyleVars } from "./ProceduralCardFace";
import { useLocalGameSettings } from "../settings/settings-values";
import { useAnimationLevel } from "../theme/motion";
import { PingOverlay } from "../overlays/PingOverlay";
import type { CardEvent, CardEventHandler, CardSide } from "./types";

const CARD_BUTTON_CLASS =
  "gc-button relative z-3 w-(--gc-w,var(--card-width)) min-w-(--gc-w,var(--card-width)) h-(--gc-h,var(--card-height)) rounded-(--card-radius-main) border border-transparent bg-transparent text-(--text-main) text-left p-[0.18rem] grid content-between gap-[0.12rem] shadow-none [transition:left_320ms_cubic-bezier(0.18,0.74,0.2,1),margin-left_320ms_cubic-bezier(0.18,0.74,0.2,1),transform_260ms_cubic-bezier(0.2,0.7,0.2,1),box-shadow_180ms_ease,opacity_160ms_ease] animate-[cardMaterialize_180ms_cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:animate-none origin-center focus:outline-none focus-visible:outline-none [&_small]:text-(--text-dim) [&_small]:text-(length:--card-body-size) [&_strong]:text-(length:--card-title-size) [&_strong]:leading-[1.18] group gb-local-board-hover-tone";

/** Zones whose cards render as art-crop tokens when `boardCardStyle` is "art". */
function isTokenZone(zone: Zone): boolean {
  return zone === "base" || zone === "runeArea" || /^battlefield/.test(zone);
}

/** Opponent zones inside the rotated player layer need a counter-rotation to read upright. */
function needsUprightFlip(owner: CardSide, zone: Zone): boolean {
  return owner === "opponent" && !/^battlefield/.test(zone);
}

export interface GameCardProps {
  card: CardInstance;
  zone: Zone;
  owner: CardSide;
  profile?: CardImageProfile;
  faceDown?: boolean;
  exhausted?: boolean;
  previewRotationDeg?: 0 | 45 | 90;
  selected?: boolean;
  targetable?: boolean;
  /** Strict-rules `legalIntents.playableCardIds` (R4-strict-ui highlight). */
  playable?: boolean;
  dimmed?: boolean;
  labels?: string[];
  attachedCards?: CardInstance[];
  mightBuff?: number;
  might?: number;
  damage?: number;
  draggable?: boolean;
  readOnly?: boolean;
  backSlot?: "deck" | "runeDeck" | "battlefield" | "landscape";
  onCardEvent?: CardEventHandler;
  style?: CSSProperties;
  className?: string;
}

/**
 * A board card: pose rotation (exhausted 90°, auto-pay preview 45°), face-down
 * flip, selection/target glow, buff/counter chips and attached-gear stacking.
 */
export function GameCard({
  card,
  zone,
  owner,
  profile = "board",
  faceDown = false,
  exhausted = false,
  previewRotationDeg,
  selected = false,
  targetable = false,
  playable,
  dimmed = false,
  labels,
  attachedCards = [],
  mightBuff = 0,
  might,
  damage = 0,
  draggable = false,
  readOnly = false,
  backSlot = "deck",
  onCardEvent,
  style,
  className,
}: GameCardProps) {
  const rotation = previewRotationDeg ?? (exhausted ? 90 : 0);
  const { boardCardStyle } = useLocalGameSettings();
  const animationLevel = useAnimationLevel();
  const meta = useMemo(() => cardMeta(card), [card]);
  // Battlefield lanes are not inside the rotated player layer: opponent cards already read upright.
  const mirrored = owner === "opponent" && !/^battlefield/.test(zone);
  const resolvedLabels = labels ?? card.customLabels ?? [];
  const whiteCounter = typeof card.whiteCounter === "number" ? Math.trunc(card.whiteCounter) : 0;
  const redCounter = typeof card.redCounter === "number" ? Math.trunc(card.redCounter) : 0;
  const resolvedMightBuff = mightBuff || Math.max(0, Math.trunc(card.temporaryMightBuff ?? 0));
  const attached = attachedCards.length;
  const interaction = useBoardInteractionOptional();
  const tokenMode =
    boardCardStyle === "art" &&
    !faceDown &&
    isTokenZone(zone) &&
    (meta.kind === "unit" || meta.kind === "gear" || meta.kind === "rune");
  const rulesObject = interaction?.slotProps?.state?.rules?.objects?.[card.id];
  const resolvedDamage = damage || Math.max(0, Math.trunc(rulesObject?.damage ?? 0));
  const resolvedMight = might ?? currentMight(meta.might, card, rulesObject);
  const tokenHeight =
    meta.kind === "rune" ? "calc(var(--card-width) * 0.9)" : "calc(var(--card-width) * 1.14)";
  const tokenWidth = meta.kind === "rune" ? "calc(var(--card-width) * 0.82)" : undefined;
  const strictLocked = !!interaction?.strictView && !interaction?.strictManual;
  const resolvedPlayable =
    playable ??
    (!!interaction?.strictView?.playableCardIds.has(card.id) ||
      !!interaction?.strictView?.activatableById.has(card.id));
  const resolvedTargetable =
    targetable || !!interaction?.strictPromptOptionIds.has(card.id);
  const promptOption = !!interaction?.strictPromptOptionIds.has(card.id);
  const promptHovered = interaction?.strictPromptHoverId === card.id;
  const effectiveHandler = onCardEvent ?? interaction?.handleCardEvent;
  const interactive = !!effectiveHandler;
  const canDrag = draggable || (!!interaction?.canAct && owner === "self");
  const pinged = interaction?.pingedCardId === card.id;
  const pingEventRef = useRef(0);
  if (pinged && !pingEventRef.current) pingEventRef.current = Date.now();
  if (!pinged && pingEventRef.current) pingEventRef.current = 0;

  const buildEvent = (type: CardEvent["type"], event?: MouseEvent<HTMLElement> | ReactPointerEvent<HTMLElement>): CardEvent => {
    const rect = event?.currentTarget?.getBoundingClientRect();
    return {
      type,
      card,
      zone,
      owner,
      exhausted,
      faceDown,
      clientX: event?.clientX,
      clientY: event?.clientY,
      pointerType: "pointerType" in (event ?? {}) ? (event as ReactPointerEvent<HTMLElement>).pointerType : undefined,
      shiftKey: event?.shiftKey,
      ctrlKey: event?.ctrlKey,
      metaKey: event?.metaKey,
      altKey: event?.altKey,
      ...(rect
        ? {
            anchorRect: {
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height,
            },
          }
        : {}),
    };
  };

  const emit = (type: CardEvent["type"], event?: MouseEvent<HTMLElement> | ReactPointerEvent<HTMLElement>) => {
    if (!effectiveHandler) return;
    effectiveHandler(buildEvent(type, event));
  };

  return (
    <div
      className={"gc-root relative" + (className ? ` ${className}` : "")}
      data-gc-style={tokenMode ? "token" : "full"}
      data-anim={animationLevel}
      style={{
        width: attachedFanWidth(attached),
        height: tokenMode ? tokenHeight : "var(--card-height)",
        ...(tokenMode ? { ["--gc-h" as string]: tokenHeight } : null),
        ...(tokenWidth ? { ["--gc-w" as string]: tokenWidth } : null),
        ...domainStyleVars(meta),
        ...style,
      }}
    >
      <div
        data-card-rotation={rotation}
        className="card-pose-rotation relative motion-reduce:transition-none!"
        style={{
          width: "var(--card-width)",
          height: tokenMode ? tokenHeight : "var(--card-height)",
          transitionDuration: "0.32s",
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
          ["--card-pose-rotation" as string]: rotation,
          ["--card-motion-rotation" as string]: "var(--card-pose-rotation)",
          transform: "rotate(calc(var(--card-pose-rotation) * 1deg))",
          opacity: dimmed ? 0.45 : undefined,
        }}
      >
        <AttachedCardFan cards={attachedCards} zone={zone} owner={owner} onCardEvent={onCardEvent} token={tokenMode} />
        <div
          className="gb-card-action-hover-scope group relative w-full h-full pointer-events-auto"
          style={{ zIndex: attached + 1 }}
        >
          <div
            className="relative w-full h-full"
            data-hover-preview-anchor="true"
            data-preview-landscape="false"
            data-preview-rotation={rotation}
            data-card-id={card.id}
            data-drop-zone={zone}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse" || !event.pointerType) emit("hover", event);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse" || !event.pointerType) emit("hoverEnd", event);
            }}
            onContextMenu={(event) => {
              if (event.shiftKey) return;
              event.preventDefault();
              event.stopPropagation();
              emit("context", event);
            }}
            onDoubleClick={(event) => emit("doubleClick", event)}
          >
            <button
              type="button"
              disabled={readOnly && !interactive}
              draggable={canDrag}
              className={CARD_BUTTON_CLASS + (tokenMode ? " overflow-visible" : " overflow-hidden")}
              style={tokenWidth ? { marginInline: "auto" } : undefined}
              data-drop-zone={zone}
              data-card-id={card.id}
              data-board-card-visual="true"
              data-visual-owner={owner}
              data-visual-hidden={faceDown}
              data-visual-dragging="false"
              data-exhausted={exhausted}
              data-face-down={faceDown}
              data-gc-token={tokenMode ? "true" : undefined}
              data-gc-selected={selected ? "true" : undefined}
              data-gc-targetable={resolvedTargetable && !selected ? "true" : undefined}
              data-strict-playable={resolvedPlayable ? "true" : undefined}
              data-strict-prompt-option={promptOption ? "true" : undefined}
              data-strict-prompt-hover={promptHovered ? "true" : undefined}
              data-pose-preview={previewRotationDeg === 45 ? "exhaust" : "none"}
              data-pose-animation="none"
              data-preview-landscape="false"
              data-preview-rotation={rotation}
              onPointerDown={(event) => {
                if (!interaction) return;
                interaction.handleCardPointerDown(event, buildEvent("select", event));
              }}
              onDragStart={(event: ReactDragEvent<HTMLButtonElement>) => {
                if (!interaction) return;
                interaction.handleCardDragStart(buildEvent("select", event), event);
              }}
              onDragEnd={() => interaction?.handleCardDragEnd()}
              onClick={(event) => emit("select", event)}
            >
              {faceDown ? (
                <div className="absolute inset-0 overflow-hidden rounded-(--card-radius-main)">
                  <CardBack slot={backSlot} insetPx={0} side={owner} />
                </div>
              ) : tokenMode ? (
                <>
                  <CardTokenFace
                    card={card}
                    side={owner}
                    profile={profile}
                    exhausted={exhausted}
                    might={resolvedMight}
                    damage={resolvedDamage}
                    flip={needsUprightFlip(owner, zone)}
                  />
                  {resolvedLabels.length > 0 ? (
                    <div className="pointer-events-none absolute inset-0 overflow-visible">
                      <CardLabelStack labels={resolvedLabels} insetPx={0} className="z-3" />
                    </div>
                  ) : null}
                </>
              ) : (
                <GameCardFace
                  card={card}
                  profile={profile}
                  labels={resolvedLabels}
                  mirrored={mirrored}
                  side={owner}
                  exhausted={exhausted}
                />
              )}
            </button>

            <CardActionButtons card={card} zone={zone} owner={owner} faceDown={faceDown} />

            {pinged ? (
              <PingOverlay
                variant={/^battlefield/.test(zone) || zone === "runeArea" ? "battlefieldMarker" : "hand"}
                eventId={pingEventRef.current}
              />
            ) : null}

            {card.revealedToOpponent ? (
              <span
                role="img"
                aria-label="Card revealed"
                className="handCardRevealIndicator pointer-events-none absolute right-[0.12rem] top-[0.12rem] z-90 inline-flex h-[1.9rem] w-[1.9rem] items-center justify-center rounded-full border border-[rgba(125,218,237,0.58)] bg-[rgba(19,62,78,0.9)] text-[#d7f6fb] shadow-[0_0_12px_rgba(88,205,238,0.52)]"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden="true">
                  <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              </span>
            ) : null}

            {!tokenMode && resolvedPlayable && !selected ? (
              <div aria-hidden="true" className="gc-ring gc-ring-playable pointer-events-none absolute -inset-[2px] z-4" />
            ) : null}
            {!tokenMode && selected ? (
              <div
                aria-hidden="true"
                className="gc-ring gc-ring-selected pointer-events-none absolute -inset-[2px] z-6"
              />
            ) : null}
            {!tokenMode && resolvedTargetable && !selected ? (
              <div aria-hidden="true" className="gc-ring gc-ring-target pointer-events-none absolute -inset-[2px] z-5" />
            ) : null}

            {!tokenMode && resolvedMightBuff > 0 ? (
              <span className="pointer-events-none absolute bottom-[0.12rem] left-[0.12rem] z-20 inline-flex items-center gap-[0.1rem] rounded-[0.16rem] border border-[rgba(139,222,189,0.6)] bg-[rgba(19,55,46,0.92)] px-[0.2rem] py-[0.06rem] text-(length:--card-label-chip-font-size) font-bold uppercase tracking-[0.04em] text-[#c8f6e3] shadow-[0_4px_10px_rgba(3,20,16,0.45)]">
                Buff {resolvedMightBuff}
              </span>
            ) : null}

            {whiteCounter !== 0 || redCounter !== 0 ? (
              <span
                className="pointer-events-auto absolute bottom-[0.12rem] left-1/2 z-20 inline-flex -translate-x-1/2 cursor-pointer items-center gap-[0.18rem] rounded-[0.16rem] border border-[rgba(220,236,255,0.34)] bg-[rgba(12,24,43,0.94)] px-[0.22rem] py-[0.06rem] text-(length:--card-label-chip-font-size) font-bold leading-none text-[#f2f7ff] shadow-[0_4px_10px_rgba(3,8,20,0.5)]"
                role="button"
                tabIndex={0}
                aria-label={`Counters ${whiteCounter} white, ${redCounter} red`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!interaction?.canAct || owner !== "self" || strictLocked) return;
                  interaction.sendIntent({
                    type: "adjust_card_counter",
                    zone,
                    cardId: card.id,
                    counter: whiteCounter !== 0 ? "white" : "red",
                    delta: 1,
                  } as GameActionIntent);
                }}
                onContextMenu={(event) => {
                  if (!interaction?.canAct || owner !== "self" || strictLocked) return;
                  event.preventDefault();
                  event.stopPropagation();
                  interaction.sendIntent({
                    type: "adjust_card_counter",
                    zone,
                    cardId: card.id,
                    counter: whiteCounter !== 0 ? "white" : "red",
                    delta: -1,
                  } as GameActionIntent);
                }}
                onWheel={(event) => {
                  if (!interaction?.canAct || owner !== "self" || strictLocked) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const delta = event.deltaY < 0 ? 1 : -1;
                  interaction.sendIntent({
                    type: "adjust_card_counter",
                    zone,
                    cardId: card.id,
                    counter: whiteCounter !== 0 ? "white" : "red",
                    delta,
                  } as GameActionIntent);
                }}
              >
                {whiteCounter !== 0 ? <span className="tabular-nums">W{whiteCounter}</span> : null}
                {redCounter !== 0 ? <span className="tabular-nums text-[#ffc9c9]">R{redCounter}</span> : null}
              </span>
            ) : null}

            {attached > 0 ? (
              <span className="pointer-events-none absolute -left-[0.18rem] -top-[0.18rem] z-20 inline-flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full border border-[rgba(139,222,189,0.5)] bg-[rgba(19,55,46,0.94)] px-[0.18rem] text-(length:--card-label-chip-font-size) font-bold text-[#c8f6e3]">
                {attached}
              </span>
            ) : null}

            {!tokenMode && typeof might === "number" && might !== card.might ? (
              <span className="pointer-events-none absolute right-[0.1rem] top-[0.1rem] z-20 inline-flex items-center gap-[0.06rem] rounded-[0.16rem] border border-[rgba(143,190,255,0.58)] bg-[rgba(15,35,62,0.94)] px-[0.2rem] py-[0.05rem] text-(length:--card-label-chip-font-size) font-black leading-none text-[#dcecff] shadow-[0_3px_8px_rgba(3,8,20,0.48)]">
                <span aria-hidden="true" className="text-[#8fc6ff]">⚔</span>
                {might}
              </span>
            ) : null}

            {!tokenMode && resolvedDamage > 0 ? (
              <span className="pointer-events-none absolute bottom-[0.1rem] right-[0.1rem] z-20 inline-flex items-center justify-center rounded-[0.16rem] border border-[rgba(255,154,154,0.7)] bg-[rgba(74,18,24,0.94)] px-[0.22rem] py-[0.05rem] text-(length:--card-label-chip-font-size) font-black leading-none text-[#ffdada] shadow-[0_3px_8px_rgba(20,3,6,0.55)]">
                −{resolvedDamage}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
