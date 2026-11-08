"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import type { CardInstance } from "@rift/protocol";
import { VARIANT_RULES } from "@rift/engine";

import { ChatPanel, type SidebarChatBinding } from "../chat";
import { useCardHoverPreview } from "../interaction/context";
import { BoardHeader, RoomActionBar } from "../header";
import { canStartNextGame, nextGameDescriptionKey } from "../header/room-actions";

import { actionClockTotals, formatElapsed } from "../header/clock";
import { GameLogPanel } from "../log";
import type { SettingsMenuProps } from "../settings/SettingsMenu";
import type { BoardSlotProps } from "../slot-types";
import { SanitizedGlobalStyles } from "./SanitizedGlobalStyles";
import { useBoardTranslator, useNow } from "./i18n";

export interface SidebarSlotProps extends BoardSlotProps {
  locale?: string;
  /** Deterministic clock for tests/screenshots. */
  now?: number;
  /** Runtime chat binding (`useChat(runtime)` fits this shape). */
  chat?: SidebarChatBinding;
  unreadCount?: number;
  clocksByPlayerId?: Record<string, string>;
  actionClockMsByPlayerId?: Record<string, number>;
  settings?: SettingsMenuProps;
  onCardHover?: (card: CardInstance, anchor?: HTMLElement | null) => void;
  onCardHoverEnd?: () => void;
  onCopyRoomCode?: (roomCode: string) => void;
  onResolve?: () => void;
  /** Chain panel (rendered between the Resolve button and chat, as in the original). */
  chain?: ReactNode;
}

interface SidebarContentProps extends SidebarSlotProps {
  compact: boolean;
  logExpanded: boolean;
  chatExpanded: boolean;
  onToggleLog: () => void;
  onToggleChat: () => void;
  onCloseOverlay?: () => void;
}

function SidebarContent({
  state,
  viewerId,
  controlledPlayerIds,
  dispatch,
  dispatchAs,
  mode,
  locale,
  now,
  chat,
  unreadCount,
  actionClock,
  clocksByPlayerId,
  actionClockMsByPlayerId,
  settings,
  onCardHover,
  onCardHoverEnd,
  onSwitchSeat,
  onNextGame,
  onLeaveRoom,
  onReturnToLobby,
  onCopyRoomCode,
  onResolve,
  onBoardEmote,
  chain,
  compact,
  logExpanded,
  chatExpanded,
  onToggleLog,
  onToggleChat,
  onCloseOverlay,
}: SidebarContentProps) {
  const t = useBoardTranslator(locale);
  const topEntry = state.chainEntries[0] ?? null;
  const livePlayerIds = useMemo(
    () => state.players.filter((player) => !player.leftAt).map((player) => player.id),
    [state.players],
  );
  const liveActionClockMs = useMemo(
    () =>
      actionClockMsByPlayerId ??
      (actionClock ? actionClockTotals(actionClock, livePlayerIds, now ?? Date.now()) : undefined),
    [actionClock, actionClockMsByPlayerId, livePlayerIds, now],
  );
  const liveClocks = useMemo(() => {
    if (clocksByPlayerId) return clocksByPlayerId;
    if (!liveActionClockMs) return undefined;
    return Object.fromEntries(
      Object.entries(liveActionClockMs).map(([playerId, ms]) => [playerId, formatElapsed(ms)]),
    );
  }, [clocksByPlayerId, liveActionClockMs]);
  const overlayChat: SidebarChatBinding = useMemo(
    () => ({
      ...(chat ?? {}),
      unreadCount: chat?.unreadCount ?? unreadCount,
      onBoardEmote: chat?.onBoardEmote ?? onBoardEmote,
    }),
    [chat, onBoardEmote, unreadCount],
  );

  return (
    <div
      data-sidebar-slot-presentation={compact ? "overlay" : "inline"}
      data-compact={compact ? "overlay" : "false"}
      className="tablet-sidebar relative h-full w-full min-h-0"
      data-hover-preview-sidebar="true"
    >
      <div className="flex h-full min-h-0 flex-col gap-[0.15rem]">
        {compact && onCloseOverlay ? (
          <button
            type="button"
            onClick={onCloseOverlay}
            aria-label={t("sim.tablet.collapseSidebar") ?? "Collapse sidebar"}
            className="absolute right-[0.34rem] top-[0.34rem] z-3 inline-flex h-[1.7rem] w-[1.7rem] items-center justify-center rounded-[0.22rem] border border-[rgba(178,198,229,0.28)] bg-[rgba(17,31,58,0.94)] text-[#dbe7ff] shadow-[0_6px_14px_rgba(2,7,16,0.36)]"
          >
            <span aria-hidden="true" className="text-[0.82rem] leading-none">
              ×
            </span>
          </button>
        ) : null}

        <BoardHeader
          state={state}
          viewerId={viewerId}
          locale={locale}
          now={now}
          clocksByPlayerId={liveClocks}
          actionClockMsByPlayerId={liveActionClockMs}
          onCopyRoomCode={onCopyRoomCode}
          settings={settings}
        />

        <RoomActionBar
          state={state}
          viewerId={viewerId}
          controlledPlayerIds={controlledPlayerIds}
          dispatch={dispatch}
          locale={locale}
          now={now}
          onSwitchSeat={onSwitchSeat}
          onNextGame={onNextGame}
          onLeaveRoom={onLeaveRoom}
          onReturnToLobby={onReturnToLobby}
          canNextGame={canStartNextGame({
            room: state,
            expectedPlayers: VARIANT_RULES[state.gameVariant ?? "duel"]?.playerCount ?? null,
          })}
          nextGameDescription={t(`sim.${nextGameDescriptionKey(state)}`) ?? undefined}
          canReturnToLobby
        />

        <GameLogPanel
          entries={state.log}
          viewerId={viewerId}
          players={state.players}
          currentTurnNumber={state.turnNumber ?? null}
          currentTurnPlayerId={state.activeTurnPlayerId ?? null}
          locale={locale}
          expanded={logExpanded}
          onToggleExpanded={onToggleLog}
          onCardHover={onCardHover}
          onCardHoverEnd={onCardHoverEnd}
        />

        <button
          type="button"
          data-sidebar-resolve="true"
          disabled={!topEntry}
          aria-label={t("sim.resolveShortcut") ?? "Resolve (S)"}
          title={
            topEntry
              ? (t("sim.resolveShortcut") ?? "Resolve (S)")
              : (t("sim.tablet.emptyChain") ?? "The chain is empty")
          }
          onClick={() => {
            if (onResolve) {
              onResolve();
              return;
            }
            if (!topEntry) return;
            const ownerId = topEntry.byPlayerId;
            if (
              mode !== "multiplayer" &&
              ownerId !== viewerId &&
              controlledPlayerIds.includes(ownerId) &&
              dispatchAs
            ) {
              dispatchAs(ownerId, {
                type: "chain_resolve",
                entryId: topEntry.id,
              });
              return;
            }
            dispatch({ type: "chain_resolve", entryId: topEntry.id });
          }}
          className="relative z-3 inline-flex min-h-[2.02rem] w-full shrink-0 items-center justify-center rounded-[0.3rem] border border-[rgba(205,228,255,0.88)] bg-[linear-gradient(180deg,rgba(96,144,212,1),rgba(58,98,157,0.98))] px-[0.68rem] text-[0.84rem] font-extrabold leading-none tracking-[0.01em] text-[#f7fbff] shadow-[0_0_0_1px_rgba(173,207,255,0.38),0_0_18px_rgba(113,168,247,0.34),0_14px_30px_rgba(21,43,81,0.46)] transition-[transform,background-color,border-color,box-shadow,color,filter] duration-160 ease-out enabled:hover:-translate-y-[1px] enabled:hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-[0.62]"
        >
          {t("sim.resolveShortcut") ?? "Resolve (S)"}
        </button>

        {chain ? <div className="min-h-0 shrink-0">{chain}</div> : null}

        <ChatPanel
          viewerId={viewerId}
          players={state.players}
          locale={locale}
          chat={overlayChat}
          expanded={chatExpanded}
          onToggleExpanded={onToggleChat}
        />
      </div>
    </div>
  );
}

/**
 * Wave-2 sidebar: turn/clock/room header, room actions, match log, Resolve, chat and
 * the optional floating board action dock.
 *
 * Below 1100px the inline column is hidden (the original tablet layout) and replaced by
 * an "Open sidebar" trigger that expands this same panel as an overlay.
 */
export function SidebarSlot(props: SidebarSlotProps) {
  const { locale, now: nowOverride, chain } = props;
  const tickingNow = useNow(1000, nowOverride === undefined);
  const now = nowOverride ?? tickingNow;
  const t = useBoardTranslator(locale);
  const hoverPreview = useCardHoverPreview();
  const [logExpanded, setLogExpanded] = useState(true);
  const [chatExpanded, setChatExpanded] = useState(true);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const closeOverlay = useCallback(() => setOverlayOpen(false), []);
  const hoverCard = useCallback(
    (card: CardInstance, anchor?: HTMLElement | null) => {
      if (props.onCardHover) props.onCardHover(card, anchor);
      else hoverPreview.showCardPreview(card, anchor ?? null, { preferredSide: "left" });
    },
    [hoverPreview, props.onCardHover],
  );
  const hoverCardEnd = useCallback(() => {
    if (props.onCardHoverEnd) props.onCardHoverEnd();
    else hoverPreview.hideCardPreview();
  }, [hoverPreview, props.onCardHoverEnd]);

  useEffect(() => {
    if (!overlayOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOverlayOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [overlayOpen]);

  return (
    <div data-sidebar-slot-root="true" className="relative h-full min-h-0 w-full">
      <SanitizedGlobalStyles />

      <div data-sidebar-inline="true" className="h-full min-h-0 w-full">
        <SidebarContent
          {...props}
          locale={locale}
          now={now}
          onCardHover={hoverCard}
          onCardHoverEnd={hoverCardEnd}
          compact={false}
          logExpanded={logExpanded}
          chatExpanded={chatExpanded}
          onToggleLog={() => setLogExpanded((current) => !current)}
          onToggleChat={() => setChatExpanded((current) => !current)}
        />
      </div>

      {mounted
        ? createPortal(
            <div data-tablet-sidebar-portal="true">
              <button
                type="button"
                data-tablet-sidebar-trigger="true"
                aria-label={t("sim.tablet.openSidebar") ?? "Open sidebar"}
                title={t("sim.tablet.openSidebar") ?? "Open sidebar"}
                onClick={() => setOverlayOpen(true)}
                className="fixed right-[0.5rem] top-[0.5rem] z-[90] h-[2.75rem] w-[2.75rem] items-center justify-center rounded-[0.32rem] border border-[rgba(166,196,233,0.34)] bg-[linear-gradient(180deg,rgba(24,42,67,0.96),rgba(13,26,44,0.98))] text-[#dcecff] shadow-[inset_0_1px_0_rgba(236,246,255,0.08),0_8px_20px_rgba(2,7,16,0.36)] backdrop-blur-md"
              >
                <span aria-hidden="true" className="grid gap-[0.14rem]">
                  <span className="block h-[0.12rem] w-[1.15rem] rounded-full bg-current" />
                  <span className="block h-[0.12rem] w-[1.15rem] rounded-full bg-current" />
                  <span className="block h-[0.12rem] w-[0.78rem] rounded-full bg-current" />
                </span>
              </button>

              {overlayOpen ? (
                <div
                  className="fixed inset-0 z-[220] flex justify-end bg-[rgba(3,8,16,0.62)] backdrop-blur-[2px]"
                  onPointerDown={(event) => {
                    if (event.target === event.currentTarget) setOverlayOpen(false);
                  }}
                >
                  <div
                    data-sidebar-overlay-panel="true"
                    className="relative h-full p-[0.2rem]"
                    style={{ width: "min(19rem, calc(100vw - 0.5rem))" }}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <SidebarContent
                      {...props}
                      locale={locale}
                      now={now}
                      onCardHover={hoverCard}
                      onCardHoverEnd={hoverCardEnd}
                      compact
                      logExpanded={logExpanded}
                      chatExpanded={chatExpanded}
                      onToggleLog={() => setLogExpanded((current) => !current)}
                      onToggleChat={() => setChatExpanded((current) => !current)}
                      onCloseOverlay={closeOverlay}
                    />
                  </div>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
