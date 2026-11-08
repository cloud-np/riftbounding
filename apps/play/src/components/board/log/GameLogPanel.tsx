"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { GameplayLogEntry } from "@rift/protocol";

import { ChevronDownIcon } from "../header/icons";
import { useBoardTranslator } from "../sidebar/i18n";
import { LogEntryRow } from "./LogEntryRow";
import {
  MATCH_LOG_PAGE_SIZE,
  groupLogEntries,
  orderLogGroupsForDisplay,
  sliceLogGroups,
} from "./log-groups";

export interface GameLogPanelProps {
  entries: readonly GameplayLogEntry[];
  viewerId: string;
  players: readonly { id: string; name: string }[];
  currentTurnNumber?: number | null;
  currentTurnPlayerId?: string | null;
  locale?: string;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  onCardHover?: (card: import("@rift/protocol").CardInstance, anchor?: HTMLElement | null) => void;
  onCardHoverEnd?: () => void;
}

export function GameLogPanel({
  entries,
  viewerId,
  players,
  currentTurnNumber = null,
  currentTurnPlayerId = null,
  locale,
  expanded = true,
  onToggleExpanded,
  onCardHover,
  onCardHoverEnd,
}: GameLogPanelProps) {
  const t = useBoardTranslator(locale);
  const groups = useMemo(
    () => groupLogEntries({ entries, currentTurnNumber, currentTurnPlayerId }),
    [entries, currentTurnNumber, currentTurnPlayerId],
  );
  const orderedGroups = useMemo(() => orderLogGroupsForDisplay(groups), [groups]);
  const totalEntries = entries.length;
  const [visibleCount, setVisibleCount] = useState(MATCH_LOG_PAGE_SIZE);
  const listRef = useRef<HTMLUListElement | null>(null);
  const moreRef = useRef<HTMLLIElement | null>(null);
  const { groups: visibleGroups, remaining } = useMemo(
    () => sliceLogGroups(orderedGroups, visibleCount),
    [orderedGroups, visibleCount],
  );

  // The original reveals older history 40 rows at a time when the sentinel below the list
  // becomes visible (IntersectionObserver on the scroll root, `ii` 0xawjzm3yjpr1.js:11725).
  useEffect(() => {
    if (remaining <= 0) return;
    const root = listRef.current;
    const target = moreRef.current;
    if (!root || !target) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisibleCount(totalEntries);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (records) => {
        if (!records.some((record) => record.isIntersecting)) return;
        setVisibleCount((current) => Math.min(totalEntries, current + MATCH_LOG_PAGE_SIZE));
      },
      { root, rootMargin: "0px 0px 100% 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [remaining, totalEntries]);

  const viewerName = players.find((player) => player.id === viewerId)?.name ?? "";
  const opponentNames = players
    .filter((player) => player.id !== viewerId)
    .map((player) => player.name);
  const namesById = useMemo(
    () => new Map(players.map((player) => [player.id, player.name])),
    [players],
  );

  return (
    <section
      data-match-log-panel="true"
      className={`relative flex min-h-0 flex-col overflow-hidden rounded-[0.18rem] border border-[rgba(155,183,219,0.18)] bg-[linear-gradient(180deg,rgba(17,30,50,0.78),rgba(9,19,34,0.84))] shadow-[inset_0_1px_0_rgba(235,246,255,0.04)] ${
        expanded ? "flex-1" : "shrink-0"
      }`}
      aria-label={t("sim.matchLogTitle") ?? "Match Log"}
    >
      <h3 className="pointer-events-none absolute top-[0.14rem] left-[0.2rem] z-1 m-0 text-[clamp(0.6rem,0.5rem+0.28vmin,0.8rem)] font-bold uppercase tracking-wider text-(--text-soft) opacity-[0.74]">
        {groups.length === 0 ? (t("sim.matchLogTitle") ?? "Match Log") : null}
      </h3>

      {expanded ? (
        <ul
          ref={listRef}
          data-match-log-list="true"
          className="relative z-2 m-0 min-h-0 flex-1 list-none overflow-auto p-0 pr-[0.02rem] grid auto-rows-min content-start gap-[0.16rem]"
        >
          {visibleGroups.map((group, groupIndex) => {
            const groupPlayerName =
              group.kind === "turn"
                ? (namesById.get(group.turnPlayerId) ?? t("sim.player") ?? "Player")
                : null;
            const label =
              group.kind === "turn"
                ? group.turnNumber === null
                  ? (t("sim.playerTurn", { playerName: groupPlayerName }) ??
                    groupPlayerName ??
                    "Player")
                  : `${t("sim.turn", { turnNumber: group.turnNumber }) ?? `Turn ${group.turnNumber}`}, ${groupPlayerName}`
                : (t("sim.earlierActivity") ?? "Earlier activity");
            const isSelf = group.kind === "turn" && group.turnPlayerId === viewerId;
            const isOpponent = group.kind === "turn" && !isSelf;
            return (
              <li
                key={`${group.kind}-${groupIndex}-${group.kind === "turn" ? group.turnPlayerId : "activity"}`}
                data-match-log-group={group.kind}
                data-turn-number={
                  group.kind === "turn" && group.turnNumber !== null ? group.turnNumber : undefined
                }
                data-turn-player-id={group.kind === "turn" ? group.turnPlayerId : undefined}
              >
                <section aria-label={label} className="grid gap-[0.05rem]">
                  <div
                    data-match-log-turn-divider={group.kind === "turn" ? "true" : undefined}
                    className={`flex items-center gap-[0.22rem] px-[0.12rem] text-[clamp(0.5rem,0.44rem+0.2vmin,0.66rem)] font-semibold uppercase tracking-[0.08em] ${
                      isSelf
                        ? "text-[rgba(139,229,196,0.9)]"
                        : isOpponent
                          ? "text-[rgba(255,196,128,0.9)]"
                          : "text-[rgba(176,195,220,0.82)]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-px min-w-[0.5rem] flex-1 ${
                        isSelf
                          ? "bg-[linear-gradient(90deg,rgba(120,221,183,0.08),rgba(120,221,183,0.5))]"
                          : isOpponent
                            ? "bg-[linear-gradient(90deg,rgba(255,187,110,0.08),rgba(255,187,110,0.5))]"
                            : "bg-[linear-gradient(90deg,rgba(166,185,209,0.06),rgba(166,185,209,0.34))]"
                      }`}
                    />
                    <span className="shrink-0">
                      {group.kind === "turn" ? (
                        <>
                          {group.turnNumber === null
                            ? (t("sim.turn", { turnNumber: "" }) ?? "Turn").trim()
                            : (t("sim.turn", { turnNumber: group.turnNumber }) ??
                              `Turn ${group.turnNumber}`)}
                          <span className="px-[0.14rem] opacity-60" aria-hidden="true">
                            ·
                          </span>
                          {groupPlayerName}
                        </>
                      ) : (
                        (t("sim.earlierActivity") ?? "Earlier activity")
                      )}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`h-px min-w-[0.5rem] flex-1 ${
                        isSelf
                          ? "bg-[linear-gradient(90deg,rgba(120,221,183,0.5),rgba(120,221,183,0.08))]"
                          : isOpponent
                            ? "bg-[linear-gradient(90deg,rgba(255,187,110,0.5),rgba(255,187,110,0.08))]"
                            : "bg-[linear-gradient(90deg,rgba(166,185,209,0.34),rgba(166,185,209,0.06))]"
                      }`}
                    />
                  </div>
                  <ul className="m-0 list-none p-0 grid auto-rows-min gap-[0.04rem]">
                    {group.entries.map((entry) => (
                      <LogEntryRow
                        key={entry.id}
                        entry={entry}
                        viewerId={viewerId}
                        viewerName={viewerName}
                        opponentNames={opponentNames}
                        locale={locale}
                        t={t}
                        onCardHover={onCardHover}
                        onCardHoverEnd={onCardHoverEnd}
                      />
                    ))}
                  </ul>
                </section>
              </li>
            );
          })}
          {remaining > 0 ? (
            <li
              ref={moreRef}
              aria-hidden="true"
              data-match-log-more={remaining}
              className="text-[clamp(0.6rem,0.53rem+0.26vmin,0.8rem)]"
              style={{ height: `calc(${remaining} * 2.16em)` }}
            />
          ) : null}
        </ul>
      ) : null}

      <button
        type="button"
        aria-expanded={expanded}
        aria-label={
          expanded
            ? (t("sim.collapseMatchLog") ?? "Collapse match log")
            : (t("sim.expandMatchLog") ?? "Expand match log")
        }
        onClick={onToggleExpanded}
        className="relative z-3 mt-[0.04rem] inline-flex h-[1.02rem] w-full shrink-0 items-center justify-center rounded-none border-x-0 border-b-0 border-t border-[rgba(176,196,222,0.26)] bg-[linear-gradient(180deg,rgba(25,40,61,0.88),rgba(18,30,48,0.92))] text-[rgba(177,195,220,0.92)] transition-colors hover:border-[rgba(198,215,240,0.38)] hover:text-(--text-soft)"
      >
        <ChevronDownIcon
          className={`h-[0.9rem] w-[0.9rem] leading-none transition-transform duration-180 ${
            expanded ? "rotate-180" : "rotate-0"
          }`}
        />
      </button>
    </section>
  );
}
