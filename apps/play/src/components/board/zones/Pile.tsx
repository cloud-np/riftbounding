"use client";

import type { CSSProperties } from "react";

import type { CardInstance } from "@rift/protocol";

import { CardBack } from "../card/CardBack";
import type { CardBackSlot } from "@/lib/assets";
import type { CardSide } from "../card/types";
import { useBoardInteractionOptional } from "../interaction/context";

interface StackPresentation {
  depthThresholds: Array<{ maxCount: number; value: number }>;
  spreadThresholds: Array<{ maxCount: number; value: number }>;
  maxSpreadRem: number;
  minLayerOpacity: number;
  layerOpacityStep: number;
  minLayerScale: number;
  layerScaleStep: number;
}

const STANDARD_STACK: StackPresentation = {
  depthThresholds: [
    { maxCount: 0, value: 0 },
    { maxCount: 1, value: 1 },
    { maxCount: 3, value: 2 },
    { maxCount: 6, value: 3 },
    { maxCount: 12, value: 4 },
    { maxCount: 20, value: 5 },
    { maxCount: 35, value: 6 },
    { maxCount: Infinity, value: 7 },
  ],
  spreadThresholds: [
    { maxCount: 1, value: 0 },
    { maxCount: 3, value: 0.12 },
    { maxCount: 6, value: 0.2 },
    { maxCount: 12, value: 0.29 },
    { maxCount: 20, value: 0.38 },
    { maxCount: 35, value: 0.47 },
    { maxCount: Infinity, value: 0.56 },
  ],
  maxSpreadRem: 0.56,
  minLayerOpacity: 0.52,
  layerOpacityStep: 0.11,
  minLayerScale: 0.93,
  layerScaleStep: 0.017,
};

const COMPACT_STACK: StackPresentation = {
  depthThresholds: [
    { maxCount: 0, value: 0 },
    { maxCount: 1, value: 1 },
    { maxCount: Infinity, value: 2 },
  ],
  spreadThresholds: [
    { maxCount: 1, value: 0 },
    { maxCount: Infinity, value: 0.16 },
  ],
  maxSpreadRem: 0.16,
  minLayerOpacity: 0.68,
  layerOpacityStep: 0.14,
  minLayerScale: 0.97,
  layerScaleStep: 0.012,
};

function thresholdValue(count: number, thresholds: Array<{ maxCount: number; value: number }>): number {
  for (const threshold of thresholds) {
    if (count <= threshold.maxCount) return threshold.value;
  }
  return thresholds[thresholds.length - 1]?.value ?? 0;
}

export interface PileStack {
  depth: number;
  maxSpreadRem: number;
  topOffsetRem: number;
  layers: Array<{ offsetRem: number; opacity: number; scale: number; zIndex: number }>;
}

/** `sW` — pile stack layers. */
export function computePileStack(
  count: number,
  presentation: StackPresentation,
  centerTopCard = false,
): PileStack {
  const depth = thresholdValue(count, presentation.depthThresholds);
  const spread = thresholdValue(count, presentation.spreadThresholds);
  const start = presentation.maxSpreadRem - spread;
  const center = centerTopCard ? presentation.maxSpreadRem / 2 : 0;
  const layers =
    depth > 0
      ? Array.from({ length: depth }).map((_, index) => {
          const last = Math.max(1, depth - 1);
          const distance = depth - 1 - index;
          return {
            offsetRem: start + (index / last) * spread - center,
            opacity: Math.max(presentation.minLayerOpacity, 1 - distance * presentation.layerOpacityStep),
            scale:
              distance === 0
                ? 1
                : Math.max(presentation.minLayerScale, 1 - distance * presentation.layerScaleStep),
            zIndex: index + 1,
          };
        })
      : [];
  return {
    depth,
    maxSpreadRem: presentation.maxSpreadRem,
    topOffsetRem: presentation.maxSpreadRem - center,
    layers,
  };
}

const COUNT_CLASS =
  "z-30 pointer-events-none leading-none [font-variant-numeric:tabular-nums] rounded-[0.36rem] border border-[rgba(220,236,255,0.24)] bg-[linear-gradient(180deg,rgba(60,86,120,0.24)_0%,rgba(11,19,33,0.52)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_0_0_1px_rgba(240,247,255,0.05),0_4px_14px_rgba(4,10,21,0.34)] backdrop-blur-md backdrop-saturate-150 text-[#f7fbff] text-[1.38rem] font-black tracking-[-0.03em] px-[0.34rem] py-[0.1rem]";

const COUNT_TEXT_CLASS =
  "[text-shadow:0_2px_0_rgba(0,0,0,0.98),0_0_8px_rgba(0,0,0,0.88),0_0_14px_rgba(4,11,28,0.7)]";

export interface PileProps {
  slot: "mainDeck" | "runeDeck" | "trash" | "banished";
  owner: CardSide;
  count: number;
  label?: string;
  cardBackSlot?: CardBackSlot;
  compact?: boolean;
  centerStackTopCard?: boolean;
  prominentCount?: boolean;
  showCount?: boolean;
  /** Opponent bands are rotated 180° so upright badges need their own rotation. */
  counterUpright?: boolean;
  onPress?: () => void;
  /** Top card for deck drag / deck-peek payloads. */
  topCard?: CardInstance | null;
  /** Drop root name; defaults to the pile slot. */
  dropZone?: string;
}

export function Pile({
  slot,
  owner,
  count,
  label,
  cardBackSlot = slot === "runeDeck" ? "runeDeck" : "deck",
  compact = false,
  centerStackTopCard = false,
  prominentCount = true,
  showCount = true,
  counterUpright = owner === "opponent",
  onPress,
  topCard = null,
  dropZone,
}: PileProps) {
  const interaction = useBoardInteractionOptional();
  const dropHandlers = interaction?.getDropZoneHandlers(dropZone ?? slot, owner);
  const canInteract = !!interaction?.canAct && owner === "self";
  const draggable = canInteract && (slot === "mainDeck" || slot === "runeDeck") && !!topCard && count > 0;
  const stack = computePileStack(count, compact ? COMPACT_STACK : STANDARD_STACK, centerStackTopCard);
  const spread = stack.maxSpreadRem;
  const boxStyle: CSSProperties = {
    width: `calc(var(--card-width) + ${spread}rem * var(--pile-stack-spread-scale, 1))`,
    height: `calc(var(--card-height) + ${spread}rem * var(--pile-stack-spread-scale, 1))`,
  };
  const sectionClass =
    "relative h-auto w-fit min-h-0 rounded-[0.08rem] border-none bg-transparent p-[0.08rem] inline-flex items-center justify-center shadow-none overflow-visible after:content-[''] after:absolute after:inset-[0.08rem] after:pointer-events-none after:gb-ornament-pile " +
    (showCount ? "after:opacity-[0.56]" : "after:opacity-[0.24]");

  const body = (
    <section
      className={sectionClass}
      data-pile-slot={slot}
      data-pile-owner={owner}
      data-pile-count={count}
      data-stack-presentation={compact ? "compact" : "standard"}
      data-stack-depth={stack.depth}
      data-stack-top-card-centered={centerStackTopCard ? "true" : "false"}
      {...dropHandlers}
      onClick={(event) => {
        event.stopPropagation();
        if (onPress) {
          onPress();
          return;
        }
        interaction?.handlePilePress(slot, owner, event);
      }}
      onContextMenu={(event) => {
        if (event.shiftKey) return;
        event.preventDefault();
        event.stopPropagation();
        interaction?.handlePileContextMenu(slot, owner, event);
      }}
      onDragStart={(event) => {
        if (!draggable || !interaction) return;
        interaction.handlePileDragStart(slot === "runeDeck" ? "runeDeck" : "mainDeck", owner, topCard, event);
      }}
      onDragEnd={() => interaction?.handlePileDragEnd()}
      draggable={draggable}
    >
      <div>
        <div className="relative" aria-hidden="true" style={boxStyle}>
          {stack.layers.map((layer, index) => (
            <div
              key={`${slot}-layer-${index}`}
              className="w-(--card-width) h-(--card-height) rounded-(--card-radius-tight) border gb-card-back-gradient absolute left-0 top-0 border-transparent shadow-none"
              style={{
                transform: `translate(calc(${layer.offsetRem}rem * var(--pile-stack-spread-scale, 1)), calc(${layer.offsetRem}rem * var(--pile-stack-spread-scale, 1))) scale(${layer.scale})`,
                transformOrigin: "center",
                opacity: layer.opacity,
                zIndex: layer.zIndex,
              }}
            />
          ))}
          {count > 0 ? (
            <div
              className="cardBack absolute left-0 top-0 border-transparent shadow-none"
              style={{
                transform: `translate(calc(${stack.topOffsetRem}rem * var(--pile-stack-spread-scale, 1)), calc(${stack.topOffsetRem}rem * var(--pile-stack-spread-scale, 1)))`,
                transformOrigin: "center",
                zIndex: 20,
                width: "var(--card-width)",
                height: "var(--card-height)",
              }}
            >
              <CardBack slot={cardBackSlot} label={label ?? slot} insetPx={0} side={owner} />
            </div>
          ) : null}
        </div>
        {showCount ? (
          <div
            data-pile-count-placement="top-right"
            className={
              "absolute z-40 pointer-events-none right-[0.22rem] top-[0.16rem]" +
              (counterUpright ? " rotate-180 origin-center" : "")
            }
          >
            <strong data-pile-counter="true" className={COUNT_CLASS}>
              <span className={COUNT_TEXT_CLASS}>{count}</span>
            </strong>
          </div>
        ) : null}
      </div>
    </section>
  );

  return onPress ? body : body;
}
