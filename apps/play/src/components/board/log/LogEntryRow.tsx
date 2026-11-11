"use client";

import { useState } from "react";

import { getCardByName } from "@rift/cards";
import type { GameLogSegment, Translator } from "@rift/i18n";
import type { GameplayLogEntry } from "@rift/protocol";

import { cardImageUrl, domainAsset, placeholderUrl, staticAsset } from "@/lib/assets";

import { DotIcon } from "../header/icons";
import {
  cardInstanceFromCard,
  deriveActionKind,
  formatLogTime,
  segmentLogEntry,
} from "./log-segments";
import { ACTION_ICONS } from "./action-icons";
import { SafeImg } from "../card/SafeImg";

const ACTION_LABEL_KEYS: Record<string, string> = {
  turn: "sim.board.matchLogActionTurn",
  inspect: "sim.board.matchLogActionInspect",
  draw: "sim.board.matchLogActionDraw",
  deck: "sim.board.matchLogActionDeck",
  trash: "sim.board.matchLogActionTrash",
  resource: "sim.board.matchLogActionResource",
  board: "sim.board.matchLogActionBoard",
  spell: "sim.board.matchLogActionSpell",
  battle: "sim.board.matchLogActionBattle",
  score: "sim.board.matchLogActionScore",
  "legend-xp": "sim.board.matchLogActionLegendXp",
  rewind: "sim.board.matchLogActionRewind",
  forward: "sim.board.matchLogActionForward",
};

export interface LogEntryRowProps {
  entry: GameplayLogEntry;
  viewerId: string;
  viewerName: string;
  opponentNames: readonly string[];
  locale?: string;
  t: Translator;
  onCardHover?: (card: import("@rift/protocol").CardInstance, anchor?: HTMLElement | null) => void;
  onCardHoverEnd?: () => void;
}

function CardThumb({ cardCode }: { cardCode?: string }) {
  const [failed, setFailed] = useState(false);
  const code = cardCode?.trim();
  if (!code) return null;
  return (
    <SafeImg
      src={failed ? placeholderUrl() : cardImageUrl({ cardCode: code }, "thumb")}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      data-log-card-art="true"
      className="h-[0.82rem] w-[1.14rem] rounded-[0.1rem] border border-black/45 bg-[rgba(8,15,25,0.82)] object-cover object-top shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
    />
  );
}

function EnergyBadge({ value, label }: { value: number; label: string }) {
  return (
    <span
      data-log-energy-badge="true"
      className="inline-flex size-[0.86rem] shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-[0.53rem] font-bold leading-none text-[#0a0f18] shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
    >
      {value}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

function PowerBadges({ value, label }: { value: number; label: string }) {
  const compact = value === 0 || value > 6;
  const icons = compact ? 1 : value;
  return (
    <span data-log-power-icons={value} className="inline-flex items-center -space-x-[0.18rem]">
      {compact ? (
        <span className="mr-[0.08rem] text-[0.56rem] font-semibold">
          {value}
          <span className="sr-only"> {label}</span>
        </span>
      ) : (
        <span className="sr-only">
          {value} {label}
        </span>
      )}
      {Array.from({ length: icons }, (_, index) => (
        <SafeImg
          key={index}
          src={staticAsset("icons/rune.webp")}
          alt=""
          aria-hidden="true"
          width={11}
          height={11}
          className="size-[0.76rem] rounded-[0.07rem]"
        />
      ))}
    </span>
  );
}

function LogSegments({
  segments,
  actionKind,
  t,
  onCardHover,
  onCardHoverEnd,
}: {
  segments: readonly GameLogSegment[];
  actionKind: string | null;
  t: Translator;
  onCardHover?: LogEntryRowProps["onCardHover"];
  onCardHoverEnd?: () => void;
}) {
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <span key={`text-${index}`}>{segment.value}</span>;
        }
        if (segment.type === "resource") {
          return (
            <span
              key={`resource-${index}`}
              data-log-resource-amount="true"
              data-log-energy={segment.kind === "power" ? undefined : segment.energy}
              data-log-power={segment.kind === "energy" ? undefined : segment.power}
              className="inline-flex items-center gap-[0.12rem] align-middle leading-none"
            >
              {segment.kind === "power" ? null : (
                <EnergyBadge value={segment.energy} label={t("sim.energy") ?? "Energy"} />
              )}
              {segment.kind === "both" ? <span className="sr-only">, </span> : null}
              {segment.kind === "energy" ? null : (
                <PowerBadges value={segment.power} label={t("sim.power") ?? "Power"} />
              )}
            </span>
          );
        }
        if (segment.type === "card") {
          const catalog = getCardByName(segment.value);
          const card = catalog ? cardInstanceFromCard(catalog) : null;
          const label =
            t("current.cardPreview", { cardName: segment.value }) ??
            `${segment.value} card preview`;
          return (
            <button
              key={`card-${index}`}
              type="button"
              data-log-card-name={segment.value}
              className="inline-flex items-center gap-[0.14rem] rounded-[0.12rem] align-middle text-[#f4fbff] transition-colors hover:text-[#fff2c9] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(255,226,167,0.72)]"
              aria-label={label}
              onMouseEnter={(event) => card && onCardHover?.(card, event.currentTarget)}
              onMouseLeave={onCardHoverEnd}
              onFocus={(event) => card && onCardHover?.(card, event.currentTarget)}
              onBlur={onCardHoverEnd}
            >
              <CardThumb cardCode={segment.cardCode} />
              <span className="inline rounded-[0.08rem] font-bold text-[#f4fbff] underline decoration-[rgba(151,201,255,0.36)] decoration-dotted underline-offset-[0.12rem]">
                {segment.value}
              </span>
            </button>
          );
        }

        const glyph = segment.domain ? domainAsset(segment.domain) : staticAsset("icons/rune.webp");
        return (
          <span
            key={`rune-${index}`}
            data-log-rune-localized="true"
            className="inline-flex items-center gap-[0.12rem] align-middle leading-[1.24]"
          >
            {segment.before ? <span>{segment.before}</span> : null}
            <SafeImg
              src={glyph}
              alt=""
              aria-hidden="true"
              width={10}
              height={10}
              data-log-rune-icon="true"
              className="inline-block rounded-[0.06rem] align-middle"
            />
            {segment.after ? <span>{segment.after}</span> : null}
          </span>
        );
      })}
    </>
  );
}

export function LogEntryRow({
  entry,
  viewerId,
  viewerName,
  opponentNames,
  locale,
  t,
  onCardHover,
  onCardHoverEnd,
}: LogEntryRowProps) {
  const actionKind = deriveActionKind(entry);
  const authoredByViewer =
    entry.authorPlayerId === viewerId ||
    entry.text.startsWith(`${viewerName} `) ||
    entry.text.startsWith(`${viewerName}'s `);
  const authoredByOpponent =
    !authoredByViewer &&
    (opponentNames.some((name) => entry.text.startsWith(`${name} `)) ||
      (!!entry.authorPlayerId && entry.authorPlayerId !== viewerId));

  const tone = authoredByViewer
    ? "bg-[rgba(120,221,183,0.92)] shadow-[0_0_6px_rgba(120,221,183,0.5)]"
    : authoredByOpponent
      ? "bg-[rgba(255,187,110,0.92)] shadow-[0_0_6px_rgba(255,187,110,0.45)]"
      : "bg-[rgba(166,185,209,0.44)]";
  const Icon = actionKind ? (ACTION_ICONS[actionKind] ?? DotIcon) : DotIcon;
  const actionLabel = actionKind
    ? (t(ACTION_LABEL_KEYS[actionKind] ?? "sim.board.matchLogActionBoard") ?? actionKind)
    : null;
  const segments = segmentLogEntry(entry, locale);

  return (
    <li className="relative rounded-[0.24rem] border border-[rgba(166,185,209,0.12)] bg-[rgba(32,49,70,0.84)] py-[0.1rem] pr-[0.24rem] pl-[0.38rem]">
      <span
        aria-hidden="true"
        className={`absolute left-[0.08rem] top-[0.12rem] bottom-[0.12rem] w-[0.1rem] rounded-full ${tone}`}
      />
      <p className="m-0 flex items-baseline gap-[0.12rem] text-[clamp(0.6rem,0.53rem+0.26vmin,0.8rem)] leading-[1.24] text-[#e2ebf8]">
        {actionKind ? (
          <span
            data-log-action-kind={actionKind}
            data-log-action-label={actionLabel ?? undefined}
            aria-hidden="true"
            title={actionLabel ?? undefined}
            className="inline-flex h-[0.78rem] w-[0.78rem] shrink-0 items-center justify-center rounded-[0.13rem] border border-[rgba(181,203,231,0.18)] bg-[rgba(10,22,37,0.38)] text-[rgba(181,203,231,0.82)]"
          >
            <Icon className="h-[0.58rem] w-[0.58rem]" />
          </span>
        ) : (
          <span
            aria-hidden="true"
            data-log-action-placeholder="true"
            className="inline-flex h-[0.78rem] w-[0.78rem] shrink-0 items-center justify-center"
          >
            <span className="h-[0.2rem] w-[0.2rem] rounded-full bg-[rgba(181,203,231,0.44)]" />
          </span>
        )}
        <span className="min-w-0">
          <span className="mr-[0.16rem] text-[clamp(0.5rem,0.44rem+0.2vmin,0.66rem)] leading-[1.08] text-(--text-dim) opacity-[0.82]">
            {formatLogTime(entry.at, locale)}
          </span>
          <LogSegments
            segments={segments}
            actionKind={actionKind}
            t={t}
            onCardHover={onCardHover}
            onCardHoverEnd={onCardHoverEnd}
          />
        </span>
      </p>
    </li>
  );
}
