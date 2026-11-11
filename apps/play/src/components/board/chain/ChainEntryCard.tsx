"use client";

import type { DragEvent } from "react";
import { motion } from "framer-motion";

import { createTranslator } from "@rift/i18n";
import { resolveCard } from "@rift/cards";
import type { ChainEntry } from "@rift/protocol";

import { CardArt } from "../card/CardArt";
import { CardBack } from "../card/CardBack";
import {
  CHAIN_ENTRY_MIME,
  hasFlowKeyword,
  hasRepeatKeyword,
  isTimeWarpCard,
  writeChainEntryDrag,
} from "./chain-utils";

const t = createTranslator("en");

export const CHAIN_SPRING = { type: "spring", stiffness: 420, damping: 34, mass: 0.62 } as const;

function cardDisplayName(entry: ChainEntry): string {
  return resolveCard(entry.card.cardCode, entry.card.name)?.name ?? entry.card.name;
}

function ModifierToggle({
  label,
  pressed,
  tone,
  onClick,
  testId,
  children,
}: {
  label: string;
  pressed: boolean;
  tone: "repeat" | "flow" | "time";
  onClick: () => void;
  testId: string;
  children: React.ReactNode;
}) {
  const tones = {
    repeat: pressed
      ? "border-[rgba(246,217,136,0.72)] bg-[linear-gradient(180deg,rgba(109,82,25,0.96),rgba(72,53,14,0.98))] text-[#fff1c8]"
      : "border-[rgba(181,185,189,0.2)] bg-[rgba(26,25,24,0.82)] text-[#d5d7d9] hover:border-[rgba(246,217,136,0.5)]",
    flow: pressed
      ? "border-[rgba(192,218,220,0.72)] bg-[linear-gradient(180deg,rgba(67,66,65,0.96),rgba(43,42,41,0.98))] text-[#f0f7f5]"
      : "border-[rgba(181,185,189,0.2)] bg-[rgba(26,25,24,0.82)] text-[#d5d7d9] hover:border-[rgba(192,218,220,0.5)]",
    time: pressed
      ? "border-[rgba(154,243,214,0.72)] bg-[linear-gradient(180deg,rgba(27,95,78,0.96),rgba(13,57,48,0.98))] text-[#c9ffec]"
      : "border-[rgba(181,185,189,0.2)] bg-[rgba(26,25,24,0.82)] text-[#d5d7d9] hover:border-[rgba(154,243,214,0.5)]",
  } as const;
  return (
    <button
      type="button"
      data-chain-top-card-action="true"
      data-chain-modifier-toggle={tone}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className={`pointer-events-auto relative inline-flex h-[2.05rem] min-w-[2.05rem] items-center justify-center rounded-[0.34rem] border px-[0.32rem] text-[0.58rem] font-black leading-none tracking-[0.02em] shadow-[0_8px_18px_rgba(8,7,6,0.42),inset_0_1px_0_rgba(255,255,255,0.08)] transition ${tones[tone]}`}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

export interface ChainEntryCardProps {
  entry: ChainEntry;
  depth: number;
  laneWidthRem: number;
  cardSizeScale: number;
  isOwner: boolean;
  queuedExtraTurn: boolean;
  onResolve?: (entry: ChainEntry) => void;
  onApprove?: (entry: ChainEntry) => void;
  onToggleRepeat?: (entry: ChainEntry, enabled: boolean) => void;
  onToggleFlow?: (entry: ChainEntry, enabled: boolean) => void;
  onToggleExtraTurn?: (entry: ChainEntry, enabled: boolean) => void;
  onDragStart?: (entry: ChainEntry, event: DragEvent<HTMLElement>) => void;
  onDragEnd?: (entry: ChainEntry, event: DragEvent<HTMLElement>) => void;
}

export function ChainEntryCard({
  entry,
  depth,
  laneWidthRem,
  cardSizeScale,
  isOwner,
  queuedExtraTurn,
  onResolve,
  onApprove,
  onToggleRepeat,
  onToggleFlow,
  onToggleExtraTurn,
  onDragStart,
  onDragEnd,
}: ChainEntryCardProps) {
  const top = depth === 0;
  const scale = Math.max(0.94, laneWidthRem / 15.5);
  const baseWidth = 0.9975 * (top ? 13.2 : depth === 1 ? 12.2 : 11.2) * scale;
  const width = `min(${(baseWidth * cardSizeScale).toFixed(3)}rem, 100%, calc(var(--chain-stack-height, 26rem) * ${(baseWidth / ((laneWidthRem - 0.3) * 1.207)).toFixed(3)}))`;
  const poseOpacity = top ? 1 : Math.max(0.68, 0.9 - 0.1 * depth);
  const poseTransform = `translate(${-(14 * depth * scale).toFixed(2)}px, ${-(6 * depth * scale).toFixed(2)}px) rotate(${-(6.5 * depth).toFixed(2)}deg) scale(${(1 - 0.024 * depth).toFixed(3)})`;
  const repeatAvailable = hasRepeatKeyword(entry);
  const flowAvailable = hasFlowKeyword(entry);
  const timeWarp = isTimeWarpCard(entry);
  const canModify = top && isOwner;
  const hiddenCard = entry.card.hidden || entry.card.isPlaceholder || !entry.card.name.trim();

  return (
    <motion.div
      className={`absolute overflow-visible aspect-[5.2/7.52] ${top ? "bottom-[0.55rem]" : "bottom-[0.65rem]"}`}
      data-chain-entry-id={entry.id}
      data-chain-depth={depth}
      initial={{ x: 20, y: 24, rotate: 5, scale: 0.96, opacity: 0 }}
      animate={{ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }}
      exit={{ x: -34, y: -12, rotate: -12, scale: 0.9, opacity: 0 }}
      transition={{
        x: CHAIN_SPRING,
        y: CHAIN_SPRING,
        rotate: CHAIN_SPRING,
        scale: CHAIN_SPRING,
        opacity: { duration: 0.2 },
      }}
      style={{
        zIndex: top ? 40 : 20 - depth,
        transformOrigin: "92% 100%",
        width,
        right: "50%",
        marginRight: `calc(${width} / -2)`,
      }}
    >
      <div
        data-chain-stack-pose="true"
        className={`group group/chain-card relative h-full w-full overflow-visible bg-[rgba(22,21,20,0.84)] transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          top
            ? isOwner
              ? "rounded-[0.32rem] border border-[rgba(139,222,189,0.58)] shadow-[0_0_0_1px_rgba(120,221,183,0.38),0_0_26px_rgba(120,221,183,0.46),0_12px_24px_rgba(9,8,7,0.52)]"
              : "rounded-[0.32rem] border border-[rgba(255,198,128,0.58)] shadow-[0_0_0_1px_rgba(255,187,110,0.38),0_0_26px_rgba(255,187,110,0.44),0_12px_24px_rgba(9,8,7,0.52)]"
            : "rounded-[0.3rem] border border-[rgba(181,185,189,0.32)] shadow-[inset_0_0_0_1px_rgba(181,185,189,0.12),0_8px_16px_rgba(10,9,8,0.42)]"
        }`}
        style={{ opacity: poseOpacity, transform: poseTransform, transformOrigin: "92% 100%" }}
      >
        {canModify && (repeatAvailable || flowAvailable || timeWarp) ? (
          <div
            className="pointer-events-none absolute left-[0.1rem] top-[0.1rem] z-40 flex flex-col gap-[0.18rem]"
            data-chain-top-card-action-stack="true"
          >
            {timeWarp && onToggleExtraTurn ? (
              <ModifierToggle
                tone="time"
                pressed={queuedExtraTurn}
                label={
                  queuedExtraTurn
                    ? (t("sim.cancelExtraTurn") ?? "Cancel extra turn")
                    : (t("sim.queueExtraTurn") ?? "Queue extra turn")
                }
                onClick={() => onToggleExtraTurn(entry, !queuedExtraTurn)}
                testId={`chain-extra-turn-${entry.id}`}
              >
                {queuedExtraTurn ? "TIME ON" : "TIME"}
              </ModifierToggle>
            ) : null}
            {repeatAvailable && onToggleRepeat ? (
              <ModifierToggle
                tone="repeat"
                pressed={!!entry.repeatEnabled}
                label={
                  entry.repeatEnabled
                    ? (t("sim.clearRepeatFor", { cardName: cardDisplayName(entry) }) ?? "Clear Repeat")
                    : (t("sim.markRepeatFor", { cardName: cardDisplayName(entry) }) ?? "Mark Repeat")
                }
                onClick={() => onToggleRepeat(entry, !entry.repeatEnabled)}
                testId={`chain-repeat-${entry.id}`}
              >
                REPEAT
              </ModifierToggle>
            ) : null}
            {flowAvailable && onToggleFlow ? (
              <ModifierToggle
                tone="flow"
                pressed={!!entry.flowEnabled}
                label={
                  entry.flowEnabled
                    ? (t("current.clearFlowFor", { cardName: cardDisplayName(entry) }) ?? "Clear Flow")
                    : (t("current.markFlowFor", { cardName: cardDisplayName(entry) }) ?? "Mark Flow")
                }
                onClick={() => onToggleFlow(entry, !entry.flowEnabled)}
                testId={`chain-flow-${entry.id}`}
              >
                FLOW
              </ModifierToggle>
            ) : null}
          </div>
        ) : null}

        <div
          draggable
          role="button"
          tabIndex={0}
          aria-label={t("current.cardPreview", { cardName: cardDisplayName(entry) }) ?? cardDisplayName(entry)}
          className="relative h-full w-full overflow-hidden rounded-[inherit]"
          data-card-id={entry.card.id}
          data-target-anchor="chain"
          data-chain-entry-drag-source="true"
          onDragStart={(event) => {
            writeChainEntryDrag(event.dataTransfer, entry);
            onDragStart?.(entry, event);
          }}
          onDragEnd={(event) => onDragEnd?.(entry, event)}
          onClick={(event) => {
            if (event.defaultPrevented) return;
            event.stopPropagation();
          }}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
            }
          }}
        >
          {hiddenCard ? (
            <CardBack slot="deck" insetPx={0} side={isOwner ? "self" : "opponent"} />
          ) : (
            <CardArt
              card={entry.card}
              profile="preview"
              side={isOwner ? "self" : "opponent"}
              className="pointer-events-none h-full w-full object-cover"
              alt={cardDisplayName(entry)}
            />
          )}
          {top ? (
            <div
              className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
              aria-hidden="true"
            />
          ) : null}
        </div>

        {top && (entry.repeatEnabled || entry.flowEnabled || queuedExtraTurn) ? (
          <span
            className="pointer-events-none absolute top-[0.52rem] left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-[0.22rem]"
            data-chain-modifier-indicator-stack="true"
          >
            {queuedExtraTurn ? (
              <span className="time-warp-chain-badge" data-chain-modifier-indicator="extra-turn">
                {t("sim.extraTurn") ?? "Extra turn"}
              </span>
            ) : null}
            {entry.repeatEnabled ? (
              <span
                data-chain-modifier-indicator="repeat"
                className="relative inline-flex items-center gap-[0.3rem] whitespace-nowrap rounded-full border border-[rgba(246,217,136,0.54)] bg-[linear-gradient(180deg,rgba(109,82,25,0.96),rgba(72,53,14,0.98))] px-[0.34rem] py-[0.24rem] text-[0.6rem] font-semibold text-[#fff1c8] shadow-[0_8px_20px_rgba(12,8,2,0.38),inset_0_1px_0_rgba(255,246,222,0.2)]"
              >
                {t("sim.repeat") ?? "Repeat"} · x2
              </span>
            ) : null}
            {entry.flowEnabled ? (
              <span
                data-chain-modifier-indicator="flow"
                className="relative inline-flex items-center gap-[0.3rem] whitespace-nowrap rounded-full border border-[rgba(192,218,220,0.58)] bg-[linear-gradient(180deg,rgba(67,66,65,0.96),rgba(43,42,41,0.98))] px-[0.34rem] py-[0.24rem] text-[0.6rem] font-semibold text-[#f0f7f5] shadow-[0_8px_20px_rgba(12,11,10,0.42),inset_0_1px_0_rgba(241,248,246,0.18)]"
              >
                {t("current.flow") ?? "Flow"}
              </span>
            ) : null}
          </span>
        ) : null}

        {top && onApprove && !isOwner ? (
          <button
            type="button"
            data-chain-top-card-action="true"
            className="pointer-events-auto absolute right-[0.1rem] top-[0.1rem] z-40 inline-flex h-[2.05rem] min-w-[2.05rem] items-center justify-center rounded-[0.34rem] border border-[rgba(164,238,204,0.42)] bg-[rgba(20,69,57,0.82)] px-[0.32rem] text-[0.58rem] font-black text-[#dffbef] shadow-[0_8px_18px_rgba(8,7,6,0.42)] transition hover:border-[rgba(190,255,226,0.72)]"
            aria-label={t("sim.hotkeyApproveChain") ?? "Approve the top effect on the chain"}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onApprove(entry);
            }}
            data-testid="chain-approve-top-card"
          >
            OK
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}
