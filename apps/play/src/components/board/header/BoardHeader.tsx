"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { GameState } from "@rift/protocol";

import { useBoardTranslator, useNow } from "../sidebar/i18n";
import { useSidebarLayout } from "../sidebar/sidebar-layout";
import { SettingsMenu, type SettingsMenuProps } from "../settings/SettingsMenu";
import { formatElapsed, matchElapsedMs } from "./clock";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  ExitFullscreenIcon,
  FullscreenIcon,
  PanelLeftCloseIcon,
} from "./icons";

const TOOL_BUTTON =
  "group relative inline-flex min-h-6 w-[1.6rem] min-w-[1.6rem] items-center justify-center self-stretch rounded-[0.28rem] border border-[rgba(178,198,229,0.22)] bg-[rgba(17,31,58,0.72)] text-[#cfe0fb] transition-colors hover:border-[rgba(207,222,245,0.36)] hover:bg-[rgba(26,43,72,0.92)] hover:text-[#edf4ff] disabled:cursor-default disabled:opacity-[0.42] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#9cc9ff]";

export interface BoardHeaderProps {
  state: GameState;
  viewerId: string;
  locale?: string;
  now?: number;
  clocksByPlayerId?: Record<string, string>;
  actionClockMsByPlayerId?: Record<string, number>;
  onCopyRoomCode?: (roomCode: string) => void;
  settings?: SettingsMenuProps;
}

export function BoardHeader({
  state,
  viewerId,
  locale,
  now,
  clocksByPlayerId,
  actionClockMsByPlayerId,
  onCopyRoomCode,
  settings,
}: BoardHeaderProps) {
  const t = useBoardTranslator(locale);
  const sidebarLayout = useSidebarLayout();
  const tickingNow = useNow(1000, now === undefined);
  const currentNow = now ?? tickingNow;
  const viewer = state.players.find((player) => player.id === viewerId) ?? state.players[0];
  const activePlayer = state.players.find((player) => player.id === state.activeTurnPlayerId);
  const opponent = state.players.find((player) => player.id !== viewer?.id);
  const isPerspectiveTurn = !!activePlayer && activePlayer.id === viewer?.id;
  const activeName = activePlayer?.name ?? t("sim.player") ?? "Player";
  const turnNumber = typeof state.turnNumber === "number" ? state.turnNumber : null;
  const bo3 = state.matchFormat === "bo3";
  const gameNumber = state.gameNumber ?? 1;
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);
  const [clockOpen, setClockOpen] = useState(false);
  const clockRef = useRef<HTMLDivElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);

  useEffect(() => {
    const sync = () => setFullscreen(!!document.fullscreenElement);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    if (!clockOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (clockRef.current?.contains(target)) return;
      setClockOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setClockOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [clockOpen]);

  const copyRoomCode = useCallback(async () => {
    if (onCopyRoomCode) {
      onCopyRoomCode(state.roomCode);
    } else {
      try {
        await navigator.clipboard.writeText(state.roomCode);
      } catch {
        /* clipboard can be blocked; the code stays visible */
      }
    }
    setCopied(true);
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 1400);
  }, [onCopyRoomCode, state.roomCode]);

  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  const toggleFullscreen = useCallback(async () => {
    try {
      setFullscreenError(false);
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        const board = document.querySelector<HTMLElement>("[data-testid='game-ready']");
        await (board ?? document.documentElement).requestFullscreen();
      }
    } catch {
      setFullscreenError(true);
    }
  }, []);

  const elapsed = formatElapsed(matchElapsedMs(state, currentNow));
  const seriesRows = bo3
    ? [...(state.bo3CompletedGames ?? [])].sort((a, b) => a.gameNumber - b.gameNumber)
    : [];
  if (bo3 && !seriesRows.some((game) => game.gameNumber === gameNumber)) {
    seriesRows.push({
      gameNumber,
      scoresByPlayerId: {
        ...(viewer ? { [viewer.id]: viewer.board?.score ?? 0 } : {}),
        ...(activePlayer ? { [activePlayer.id]: activePlayer.board?.score ?? 0 } : {}),
      },
      durationMs: matchElapsedMs(state, currentNow),
      actionClockMsByPlayerId: actionClockMsByPlayerId,
    });
  }

  return (
    <div className="grid gap-[0.14rem]">
      <div
        data-sidebar-room-header="true"
        className="grid grid-cols-[0.22rem_minmax(0,1fr)_auto] gap-x-[0.2rem] gap-y-[0.08rem] rounded-[0.18rem] border border-[rgba(155,183,219,0.18)] bg-[linear-gradient(180deg,rgba(20,35,55,0.82),rgba(12,23,40,0.86))] px-[0.2rem] py-[0.1rem] shadow-[inset_0_1px_0_rgba(235,246,255,0.05)]"
      >
        <span
          role="img"
          data-sidebar-turn-indicator={isPerspectiveTurn ? "self" : "opponent"}
          aria-label={t("sim.playerTurn", { playerName: activeName }) ?? `${activeName}'s turn`}
          title={t("sim.playerTurn", { playerName: activeName }) ?? `${activeName}'s turn`}
          className={`col-start-1 row-start-1 row-span-2 w-full rounded-full ${
            isPerspectiveTurn ? "bg-[#78ddb7]" : "bg-[#f4d06f]"
          }`}
        />

        <div className="col-start-2 row-start-1 flex min-w-0 items-center gap-[0.26rem]">
          {turnNumber !== null ? (
            <p className="m-0 shrink-0 whitespace-nowrap text-[0.92rem] font-semibold leading-none tracking-[0.02em] text-[#edf4ff]">
              {t("sim.turn", { turnNumber }) ?? `Turn ${turnNumber}`}
            </p>
          ) : null}
          <span className="shrink-0 whitespace-nowrap text-[0.72rem] font-semibold leading-none text-[#a9bbd4]">
            {t("sim.playerTurn", { playerName: activeName }) ?? `${activeName}'s turn`}
          </span>
          {bo3 ? (
            <span
              data-bo3-timer-game={gameNumber}
              className="ml-auto shrink-0 whitespace-nowrap text-[0.76rem] font-medium leading-none text-[#a9bbd4]"
            >
              {t("sim.game", { gameNumber }) ?? `Game ${gameNumber}`}
            </span>
          ) : null}
        </div>

        <div
          data-sidebar-room-metadata="true"
          className="col-start-2 row-start-2 flex min-w-0 flex-wrap items-center gap-[0.14rem]"
        >
          <div
            data-sidebar-room-clock="true"
            className="relative flex shrink-0 items-center gap-[0.26rem]"
          >
            <div ref={clockRef} className="relative flex shrink-0 items-center gap-[0.14rem]">
              <span
                suppressHydrationWarning
                className="whitespace-nowrap text-[0.64rem] font-semibold tabular-nums text-[#8fa8c8]"
              >
                {elapsed}
              </span>
              {bo3 ? (
                <button
                  type="button"
                  aria-label={
                    clockOpen
                      ? (t("sim.hideGameTimingBreakdown") ?? "Hide game timing breakdown")
                      : (t("sim.showGameTimingBreakdown") ?? "Show game timing breakdown")
                  }
                  aria-expanded={clockOpen}
                  title={t("sim.gameTimingBreakdown") ?? "Game timing breakdown"}
                  onClick={() => setClockOpen((current) => !current)}
                  className="inline-flex h-[0.9rem] w-[0.9rem] items-center justify-center rounded-[0.16rem] text-[#8fa5c5] transition-colors hover:bg-[rgba(148,177,216,0.12)] hover:text-[#edf4ff]"
                >
                  <ChevronDownIcon
                    className={`h-[0.68rem] w-[0.68rem] transition-transform duration-150 ${
                      clockOpen ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </button>
              ) : null}
              {clockOpen && bo3 ? (
                <div
                  role="region"
                  aria-label={t("sim.gameTimingBreakdown") ?? "Game timing breakdown"}
                  className="absolute left-0 top-[calc(100%+0.36rem)] z-140 max-h-[calc(100dvh-4rem)] w-[15.5rem] max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-[0.34rem] border border-[rgba(162,190,228,0.26)] bg-[linear-gradient(180deg,rgba(16,29,49,0.98),rgba(10,20,36,0.99))] px-[0.48rem] py-[0.42rem] text-left shadow-[0_12px_30px_rgba(2,8,18,0.42)]"
                >
                  <div className="grid grid-cols-[2px_minmax(0,1fr)_2rem_3rem] items-center gap-x-[0.32rem] pb-[0.32rem] text-[0.56rem] font-bold uppercase leading-none tracking-[0.06em] text-[#8298b9]">
                    <span aria-hidden="true" className="col-span-2" />
                    <span className="text-center">{t("sim.gameTimingScore") ?? "Score"}</span>
                    <span className="text-right">{t("sim.gameTimingElapsed") ?? "Elapsed"}</span>
                  </div>
                  <ol className="m-0 list-none p-0 text-[0.68rem] font-semibold leading-none text-[#dce8f8] [font-variant-numeric:tabular-nums]">
                    {seriesRows.map((game) => (
                      <li
                        key={game.gameNumber}
                        data-bo3-timer-game={game.gameNumber}
                        className="border-t border-[rgba(162,190,228,0.13)] py-[0.38rem]"
                      >
                        <div className="grid grid-cols-[2px_minmax(0,1fr)_2rem_3rem] items-center gap-x-[0.32rem]">
                          <h3 className="col-span-3 m-0 whitespace-nowrap text-[0.68rem] font-semibold text-[#9fb2ce]">
                            {t("sim.game", { gameNumber: game.gameNumber }) ??
                              `Game ${game.gameNumber}`}
                          </h3>
                          <span
                            data-bo3-timer-elapsed="true"
                            className="min-w-[3rem] text-right text-[#c9d8ec]"
                          >
                            {formatElapsed(game.durationMs)}
                          </span>
                        </div>
                        <div className="mt-[0.34rem] grid gap-[0.24rem]">
                          {[
                            {
                              player: viewer,
                              score: game.scoresByPlayerId[viewer?.id ?? ""] ?? 0,
                              tone: "perspective",
                              rail: "bg-[#78ddb7]",
                              text: "text-[#bdebdc]",
                            },
                            {
                              player: opponent,
                              score: game.scoresByPlayerId[opponent?.id ?? ""] ?? 0,
                              tone: "opponent",
                              rail: "bg-[#ffbb6e]",
                              text: "text-[#ffd39e]",
                            },
                          ].map((row) =>
                            row.player ? (
                              <div
                                key={row.player.id}
                                data-bo3-timer-player={row.player.id}
                                data-bo3-timer-tone={row.tone}
                                className="grid grid-cols-[2px_minmax(0,1fr)_2rem_3rem] items-center gap-x-[0.32rem]"
                              >
                                <span
                                  aria-hidden="true"
                                  className={`min-h-[0.84rem] self-stretch rounded-full ${row.rail}`}
                                />
                                <span
                                  data-bo3-timer-player-name="true"
                                  className="min-w-0 whitespace-normal break-words leading-[1.12] text-[#b9c9dd]"
                                >
                                  {row.player.name}
                                </span>
                                <span
                                  data-bo3-timer-player-score={row.player.id}
                                  className={`text-center ${row.text}`}
                                >
                                  {row.score}
                                </span>
                                <span className={`min-w-[2.65rem] text-right ${row.text}`}>
                                  {(() => {
                                    const completed = (state.bo3CompletedGames ?? []).some(
                                      (entry) => entry.gameNumber === game.gameNumber,
                                    );
                                    if (!completed && clocksByPlayerId?.[row.player.id]) {
                                      return clocksByPlayerId[row.player.id];
                                    }
                                    const clock = game.actionClockMsByPlayerId?.[row.player.id];
                                    return typeof clock === "number" ? formatElapsed(clock) : "—";
                                  })()}
                                </span>
                              </div>
                            ) : null,
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void copyRoomCode()}
            aria-label={
              copied
                ? (t("sim.roomCodeCopied") ?? "Room code copied")
                : (t("sim.copyRoomCode") ?? "Copy room code")
            }
            title={
              copied
                ? (t("sim.roomCodeCopied") ?? "Room code copied")
                : (t("sim.copyRoomCode") ?? "Copy room code")
            }
            className={`group ml-auto inline-flex shrink-0 items-center gap-[0.18rem] whitespace-nowrap rounded-[0.2rem] text-[0.64rem] leading-none transition-colors ${
              copied ? "text-[#dff4ff]" : "text-[#95a8c7] hover:text-[#dbe7fb]"
            }`}
          >
            <span
              data-sidebar-room-label="true"
              style={{ display: "inline" }}
              className="uppercase tracking-[0.03em] text-[#6f83a3] transition-colors group-hover:text-[#9fb5d6]"
            >
              {t("sim.room") ?? "Room:"}
            </span>
            <span className="max-w-[5.6rem] overflow-hidden text-ellipsis font-mono text-[0.74rem] font-semibold text-[#edf4ff]">
              {state.roomCode}
            </span>
            <span
              aria-hidden="true"
              className={`inline-flex h-[0.72rem] w-[0.72rem] items-center justify-center transition-[opacity,transform,color] duration-120 ${
                copied
                  ? "translate-y-0 text-[#dff4ff] opacity-100"
                  : "translate-y-px text-[#8ea4c6] opacity-70 group-hover:translate-y-0 group-hover:text-[#dbe7fb] group-hover:opacity-100"
              }`}
            >
              {copied ? (
                <CheckIcon className="h-[0.72rem] w-[0.72rem]" />
              ) : (
                <CopyIcon className="h-[0.72rem] w-[0.72rem]" />
              )}
            </span>
          </button>
        </div>

        {/* The verbatim CSS reserves 3.3rem to the right of the tools for the original's
            rail-mounted sidebar/fullscreen buttons. Our header hosts those controls itself,
            so reclaim the reserve (the room-code line below stays width-capped). */}
        <div
          data-sidebar-header-tools="true"
          style={{ marginRight: 0 }}
          className="col-start-3 row-start-1 row-span-2 relative flex min-h-[2.3rem] items-stretch gap-[0.14rem]"
        >
          <SettingsMenu {...settings} locale={settings?.locale ?? locale} />
          {sidebarLayout ? (
            <button
              type="button"
              data-testid="sidebar-layout-toggle"
              aria-label={t("sim.tablet.collapseSidebar") ?? "Collapse sidebar"}
              title={t("sim.tablet.collapseSidebar") ?? "Collapse sidebar"}
              aria-expanded={!sidebarLayout.collapsed}
              onClick={sidebarLayout.toggle}
              className={TOOL_BUTTON}
            >
              <PanelLeftCloseIcon className="h-[0.78rem] w-[0.78rem]" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label={
              fullscreen
                ? (t("sim.tablet.exitFullscreen") ?? "Exit fullscreen")
                : (t("sim.tablet.fullscreen") ?? "Enter fullscreen")
            }
            title={
              fullscreen
                ? (t("sim.tablet.exitFullscreen") ?? "Exit fullscreen")
                : (t("sim.tablet.fullscreen") ?? "Enter fullscreen")
            }
            onClick={() => void toggleFullscreen()}
            className={TOOL_BUTTON}
          >
            {fullscreen ? (
              <ExitFullscreenIcon className="h-[0.78rem] w-[0.78rem]" />
            ) : (
              <FullscreenIcon className="h-[0.78rem] w-[0.78rem]" />
            )}
          </button>
          {fullscreenError ? (
            <span
              role="status"
              className="pointer-events-none absolute right-0 top-[calc(100%+0.24rem)] w-[10rem] rounded-[0.2rem] border border-[rgba(226,171,124,0.34)] bg-[rgba(52,33,25,0.96)] px-[0.3rem] py-[0.18rem] text-[0.52rem] leading-[1.3] text-[#efc3a1]"
            >
              {t("sim.tablet.fullscreenError") ?? "Could not enter fullscreen."}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
