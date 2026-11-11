"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import type { GameVariant, Room, RoomPlayer } from "@rift/protocol";

import type { CardEventHandler } from "../card/types";
import { ActionDock, type ArmedCounter } from "../dock";
import { useBoardInteractionOptional } from "../interaction/context";
import { useLocalGameSettings } from "../settings/settings-values";
import {
  computeBoardLayout,
  computeScoreTrack,
  isPhonePortrait,
  type BoardMode,
} from "./board-metrics";
import {
  boardModeFor,
  isCompactViewport,
  isPhonePortraitViewport,
  useBoardViewport,
  useSimPointerTracking,
  TOUCH_HAND_CARD_SCALE,
  TOUCH_PLAYER_BAND_PADDING_REM,
} from "./use-board-viewport";
import { BattlefieldLayer, type BattlefieldInfo } from "./BattlefieldLayer";
import { BoardTurnControls } from "../header/BoardTurnControls";
import { IdentityBadge } from "./IdentityBadge";
import { PlayerLayer } from "./PlayerLayer";
import { Playmat } from "./Playmat";
import { ArenaBackdrop } from "../backdrop/ArenaBackdrop";
import { BoardCustomizationProvider } from "./customization";
import { IdentityRail, ScoreTrack } from "./ScoreTrack";
import { OpponentPhaseIndicator, PhaseIndicator } from "./TurnControls";
import { SidebarLayoutContext, useSidebarLayoutState } from "../sidebar/sidebar-layout";
import { PanelLeftOpenIcon } from "../header/icons";
import { RoomActionBar } from "../header/RoomActionBar";
import { canStartNextGame } from "../header/room-actions";

const VARIANT_VICTORY_SCORE: Record<GameVariant, number> = {
  duel: 8,
  free_for_all_3: 8,
  free_for_all_4: 8,
  teams_2v2: 11,
};

export interface GameBoardLayoutHints {
  mode?: BoardMode;
  boardLines?: "default" | "ink" | "legend" | "signature_legend";
  showScoreTrack?: boolean;
  showSidebarSlot?: boolean;
  showTurnControls?: boolean;
  canEndTurn?: boolean;
  canSwitchSeat?: boolean;
  phase?: "beginning" | "main";
  activeTurnSide?: "self" | "opponent";
  clocksByPlayerId?: Record<string, string>;
  /** Currently connected seats (presence); bots are always online. */
  connectedPlayerIds?: readonly string[];
  battlefields?: {
    own?: BattlefieldInfo;
    opponent?: BattlefieldInfo;
    supplemental?: BattlefieldInfo;
    token?: BattlefieldInfo;
  };
  selectedCardIds?: string[];
  targetableCardIds?: string[];
  autoPayPreviewCardIds?: string[];
  hoveredCardId?: string | null;
  handRevealed?: boolean;
  opponentHandRevealed?: boolean;
  compactBattlefieldColumns?: string | null;
  sidebarWidthRem?: number;
}

export interface GameBoardSlots {
  /** Wave-2 hand fan implementation (falls back to the built-in fan). */
  hand?: ReactNode;
  /** Wave-2 match log / chat / resolve sidebar. */
  sidebar?: ReactNode;
  /** Wave-2 prompts & dialogs. */
  prompts?: ReactNode;
  /** Wave-2 target arrows, emotes, ping flashes, drag ghost. */
  overlays?: ReactNode;
  /** Wave-2 chain panel (defaults to an empty chain lane). */
  chain?: ReactNode;
}

export interface GameBoardViewProps {
  state: Room;
  viewerId: string;
  layoutHints?: GameBoardLayoutHints;
  slots?: GameBoardSlots;
  onCardEvent?: CardEventHandler;
  className?: string;
}

const ROOT_CLASS_SCORE =
  "gb-board relative h-full w-full grid grid-cols-[minmax(0,1fr)_var(--chain-lane-width)] [--score-track-lane-clearance:clamp(0.625rem,calc(var(--card-width)*0.12),0.9rem)] [--battlefield-side-gap:max(6.3rem,calc(var(--card-width)*1.64),calc(var(--score-track-rail-width)+var(--track-player-nudge)+var(--track-player-nudge)+var(--score-track-lane-clearance)+var(--score-track-lane-clearance)))] [--board-side-utility-edge-gap:0.5rem] [--board-side-utility-width:min(9.4rem,calc(var(--battlefield-side-gap)-1rem))] [--identity-badge-height:max(4.25rem,calc(var(--track-node-size)*1.18+0.32rem+var(--identity-badge-height-delta)))] [--identity-badge-width:min(10.3rem,calc(var(--battlefield-side-gap)-0.5rem))] [--identity-rail-width:var(--identity-badge-width)] [--track-node-size:clamp(2.7rem,2.55cqw,3.9rem)] [--track-node-winning-size:calc(var(--track-node-size)*1.24)] [--score-track-column-gap:calc(var(--track-node-size)*0.34)] [--score-track-rail-width:calc(var(--track-node-size)*2+var(--score-track-column-gap))] [--score-track-stagger-offset:calc(var(--track-row-size)*0.5)] [--score-track-terminal-offset:calc(var(--track-node-size)*0.5)] [--track-row-size:calc(var(--track-node-size)*1.42)] [--track-edge-inset:calc((var(--battlefield-side-gap)-var(--score-track-rail-width))/2)] [--track-player-bottom:calc(var(--identity-badge-edge-inset)+var(--identity-badge-height)+var(--identity-track-gap))] [--track-opponent-score-top:calc(var(--identity-badge-edge-inset)+var(--identity-badge-height)+var(--identity-track-gap))] [--turn-control-bottom:calc(var(--battlefield-inset)-0.36rem)] gap-0 p-0 rounded-2xl border border-[rgba(159,168,191,0.42)] gb-board-root-bg shadow-[inset_0_-1px_0_rgba(12,11,10,0.4),0_12px_26px_rgba(9,8,7,0.5)] isolate select-none overflow-visible before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none before:gb-board-root-glow after:content-[''] after:absolute after:inset-[0.34rem] after:rounded-[0.48rem] after:pointer-events-none after:shadow-[inset_0_0_0_9999px_rgba(2,7,5,0.03)] [&_input]:select-text [&_textarea]:select-text [&_select]:select-text";

const ROOT_CLASS_COMPACT =
  "gb-board relative h-full w-full grid grid-cols-[minmax(0,1fr)_var(--chain-lane-width)] [--battlefield-side-gap:calc(var(--card-width)*1.22)] gap-0 p-0 rounded-2xl border border-[rgba(159,168,191,0.42)] gb-board-root-bg shadow-[inset_0_-1px_0_rgba(12,11,10,0.4),0_12px_26px_rgba(9,8,7,0.5)] isolate select-none overflow-visible before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none before:gb-board-root-glow after:content-[''] after:absolute after:inset-[0.34rem] after:rounded-[0.48rem] after:pointer-events-none after:shadow-[inset_0_0_0_9999px_rgba(2,7,5,0.03)] [&_input]:select-text [&_textarea]:select-text [&_select]:select-text";

function CompactOpponentRail({
  player,
  score,
  clock,
  count,
}: {
  player: RoomPlayer;
  score: number;
  clock?: string;
  count: number;
}) {
  return (
    <div
      data-compact-opponent-board="true"
      data-compact-observer-player-layer={player.id}
      className="hud-glass-panel pointer-events-none absolute left-[calc(var(--battlefield-side-gap)+0.2rem)] right-[calc(var(--battlefield-side-gap)+0.2rem)] top-[calc(0.35rem+var(--compact-opponent-index,0)*4.6rem)] z-11 flex h-[4.1rem] items-center gap-[0.5rem] px-[0.5rem]"
      style={{ ["--compact-opponent-index" as string]: count }}
    >
      <div className="grid h-[2.1rem] w-[2.1rem] place-items-center rounded-full border border-[rgba(231,185,117,0.6)] bg-[rgba(30,29,28,0.9)] text-[0.9rem] font-black text-[#ffedc9]">
        {score}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.74rem] font-bold text-[#f3f3f4]">{player.name}</div>
        <div className="flex gap-[0.5rem] text-[0.56rem] uppercase tracking-[0.06em] text-[#afb4bb]">
          <span>Deck {player.board?.deck.length ?? 0}</span>
          <span>Hand {player.board?.hand.length ?? 0}</span>
          {clock ? <span>{clock}</span> : null}
        </div>
      </div>
      <div className="flex items-end gap-[0.18rem]">
        <div className="h-[2.2rem] w-[1.6rem] rounded-[0.14rem] border border-[rgba(180,183,188,0.24)] bg-[linear-gradient(145deg,#484746,#383736)]" />
        <div className="h-[2.2rem] w-[1.6rem] rounded-[0.14rem] border border-[rgba(180,183,188,0.24)] bg-[linear-gradient(145deg,#484746,#383736)]" />
      </div>
    </div>
  );
}

export function GameBoardView({
  state,
  viewerId,
  layoutHints = {},
  slots,
  onCardEvent,
  className,
}: GameBoardViewProps) {
  const boardRef = useRef<HTMLElement | null>(null);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const interaction = useBoardInteractionOptional();
  const effectiveCardHandler = onCardEvent ?? interaction?.handleCardEvent;
  const [size, setSize] = useState({
    board: { widthPx: 1450, heightPx: 670 },
    field: { widthPx: 1450, heightPx: 670 },
  });

  const viewer = useMemo<RoomPlayer>(() => {
    return state.players.find((player) => player.id === viewerId) ?? state.players[0]!;
  }, [state.players, viewerId]);
  const opponents = useMemo(
    () => state.players.filter((player) => player.id !== viewer.id).slice(0, 3),
    [state.players, viewer.id],
  );
  const usesCompactOpponentRail = state.players.length > 2 && opponents.length > 1;
  const opponent = opponents[0] ?? null;
  const detectedViewport = useBoardViewport();
  useSimPointerTracking();
  const mode: BoardMode =
    layoutHints.mode ?? (detectedViewport ? boardModeFor(detectedViewport) : "desktop");
  const phonePortrait =
    detectedViewport && !layoutHints.mode
      ? isPhonePortraitViewport(detectedViewport, mode)
      : isPhonePortrait(size.board, mode);
  const compactViewport =
    detectedViewport && !layoutHints.mode ? isCompactViewport(detectedViewport, mode) : false;
  const touchLayout = mode === "touch";
  const tabletCompact = touchLayout || compactViewport;
  const sidebarLayout = useSidebarLayoutState();
  const hasSidebar = !!slots?.sidebar && layoutHints.showSidebarSlot !== false;
  const sidebarCollapsed = hasSidebar && sidebarLayout.collapsed;
  const localSettings = useLocalGameSettings();
  // Original `ak`: card-size setting scales the card/board metrics after layout
  // (`0xawjzm3yjpr1.js:48887`, `52352`, `52460`, `61729`).
  const cardSizeScale = Math.max(0.5, Math.min(1.5, localSettings.cardSizePercent / 100));

  const layout = useMemo(
    () =>
      computeBoardLayout({
        board: size.board,
        field: size.field,
        mode,
        usesCompactOpponentRail,
        rootRemPx: 16,
        phonePortrait,
        // The original preview/game uses the touch density formula on the phone
        // arrangement; tablet touch layouts use the viewport-fit density branch.
        cardSizeScale: phonePortrait ? cardSizeScale : undefined,
      }),
    [size, mode, usesCompactOpponentRail, phonePortrait, cardSizeScale],
  );
  const metrics = useMemo(
    () => ({
      ...layout.metrics,
      boardScale: Number((layout.metrics.boardScale * cardSizeScale).toFixed(4)),
      cardWidthRem: Number((layout.metrics.cardWidthRem * cardSizeScale).toFixed(3)),
      cardHeightRem: Number((layout.metrics.cardHeightRem * cardSizeScale).toFixed(3)),
      battlefieldOverlapRem: Number(
        (layout.metrics.battlefieldOverlapRem * cardSizeScale).toFixed(3),
      ),
    }),
    [layout.metrics, cardSizeScale],
  );
  const { composition } = layout;
  const variant: GameVariant = state.gameVariant ?? "duel";
  const baseVictoryScore = VARIANT_VICTORY_SCORE[variant] ?? 8;
  const aspirantsClimbBonus = (["own", "opponent", "supplemental"] as const).reduce(
    (total, key) => {
      const info = layoutHints.battlefields?.[key];
      if (!info || info.name.trim().toLowerCase() !== "aspirant's climb") return total;
      return total + (state.battlefieldBrushByZone?.[info.zone] ? 0 : 1);
    },
    0,
  );
  const victoryScore = baseVictoryScore + aspirantsClimbBonus;
  const scoreTrack = useMemo(
    () =>
      computeScoreTrack({
        maxValue: victoryScore,
        baseTrackNodeSize: `${metrics.trackNodeSizeRem}rem`,
        baseTrackNodeSizeRem: metrics.trackNodeSizeRem,
        maxTrackStackBottomRem: undefined,
        trackStaticTopOffsetRem: undefined,
      }),
    [victoryScore, metrics.trackNodeSizeRem],
  );

  useEffect(() => {
    const board = boardRef.current;
    const field = fieldRef.current;
    if (!board || !field) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const boardRect = board.getBoundingClientRect();
        const fieldRect = field.getBoundingClientRect();
        if (!boardRect.width || !boardRect.height || !fieldRect.width || !fieldRect.height) return;
        setSize({
          board: { widthPx: boardRect.width, heightPx: boardRect.height },
          field: { widthPx: fieldRect.width, heightPx: fieldRect.height },
        });
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    observer.observe(field);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const selected = useMemo(
    () =>
      new Set([...(layoutHints.selectedCardIds ?? []), ...(interaction?.selectedCardIds ?? [])]),
    [layoutHints.selectedCardIds, interaction?.selectedCardIds],
  );
  const targetable = useMemo(
    () =>
      new Set([
        ...(layoutHints.targetableCardIds ?? []),
        ...(interaction?.targetableCardIds ?? []),
      ]),
    [layoutHints.targetableCardIds, interaction?.targetableCardIds],
  );
  const autoPayPreview = useMemo(
    () => new Set(layoutHints.autoPayPreviewCardIds ?? []),
    [layoutHints.autoPayPreviewCardIds],
  );

  const showScoreTrack = layoutHints.showScoreTrack !== false;
  const phase = layoutHints.phase ?? (state.activeTurnStep === "beginning" ? "beginning" : "main");
  const activeTurnSide =
    layoutHints.activeTurnSide ?? (state.activeTurnPlayerId === viewer.id ? "self" : "opponent");
  const showTurnControls = layoutHints.showTurnControls ?? activeTurnSide === "self";

  const boardStyle: CSSProperties = {
    ["--showdown-inline-left" as string]: undefined,
    ["--board-scale" as string]: metrics.boardScale,
    ["--board-field-height" as string]: `${metrics.fieldHeightRem}rem`,
    ["--compact-turn-control-height" as string]: "2.75rem",
    ["--tablet-hand-card-scale" as string]: touchLayout
      ? composition.arrangement === "phone-portrait"
        ? TOUCH_HAND_CARD_SCALE.phone
        : TOUCH_HAND_CARD_SCALE.tablet
      : 1,
    ["--touch-player-band-padding" as string]: touchLayout
      ? `${TOUCH_PLAYER_BAND_PADDING_REM[composition.handControls]}rem`
      : "0rem",
    ["--desktop-ui-scale" as string]: touchLayout
      ? 1
      : Math.min(
          1.35,
          metrics.boardScale <= 1 ? metrics.boardScale : 1 + (metrics.boardScale - 1) * 0.5,
        ),
    ["--board-right-safety-gutter" as string]: `${metrics.boardRightSafetyGutterRem}rem`,
    ["--track-node-size" as string]: scoreTrack.trackNodeSize,
    ["--score-track-column-gap" as string]: scoreTrack.trackColumnGap,
    ["--score-track-rail-width" as string]: scoreTrack.trackRailWidth,
    ["--track-row-size" as string]: scoreTrack.trackRowSize,
    ["--card-width" as string]: `${metrics.cardWidthRem}rem`,
    ["--card-height" as string]: `${metrics.cardHeightRem}rem`,
    ["--placed-card-width" as string]: `${metrics.cardWidthRem}rem`,
    ["--placed-card-height" as string]: `${metrics.cardHeightRem}rem`,
    ["--card-peek-width" as string]: `clamp(${Number((8.8 * cardSizeScale).toFixed(3))}rem,${Number((24.2 * cardSizeScale).toFixed(3))}vw,${Number((15.4 * cardSizeScale).toFixed(3))}rem)`,
    ["--battlefield-overlap" as string]: `${metrics.battlefieldOverlapRem}rem`,
    ["--battlefield-top-inset" as string]: touchLayout
      ? usesCompactOpponentRail
        ? "var(--tablet-opponent-band)"
        : composition.arrangement === "phone-portrait"
          ? "calc(var(--tablet-player-band) + var(--phone-score-height))"
          : "var(--tablet-player-band)"
      : usesCompactOpponentRail
        ? "calc(30% - 0.36rem)"
        : "calc(var(--battlefield-inset) - 0.36rem)",
    ["--battlefield-bottom-inset" as string]: touchLayout
      ? composition.arrangement === "phone-portrait"
        ? "calc(var(--tablet-player-band) + var(--phone-score-height))"
        : "var(--tablet-player-band)"
      : "calc(var(--battlefield-inset) - 0.36rem)",
    ["--local-player-layer-bottom-inset" as string]: `${0.32 * Number(usesCompactOpponentRail)}rem`,
    ["--chain-lane-width" as string]:
      slots?.chain || slots?.sidebar
        ? sidebarCollapsed
          ? "0rem"
          : `${metrics.chainLaneWidthRem}rem`
        : "0rem",
    ["--identity-totem-width" as string]: `${metrics.identityTotemWidthRem}rem`,
    ["--identity-track-gap" as string]: `${metrics.identityTrackGapRem}rem`,
    ["--identity-rail-pad" as string]: `${metrics.identityRailPadRem}rem`,
    ["--identity-rail-vpad" as string]: `${metrics.identityRailVPadRem}rem`,
    ["--track-player-nudge" as string]: `${metrics.trackPlayerNudgeRem}rem`,
    ["--track-opponent-nudge" as string]: `${metrics.trackOpponentNudgeRem}rem`,
    ["--track-opponent-top" as string]: `${metrics.trackOpponentTopRem}rem`,
    ["--identity-badge-player-nudge" as string]: `${metrics.trackPlayerNudgeRem}rem`,
    ["--identity-badge-opponent-nudge" as string]: `${metrics.trackOpponentNudgeRem}rem`,
    ["--identity-badge-height-delta" as string]: "1.9rem",
    ["--identity-badge-edge-inset" as string]: `${Math.max(0.16, metrics.trackOpponentTopRem - 0.48)}rem`,
    ["--turn-control-bottom" as string]: `${metrics.turnControlBottomRem}rem`,
  };

  const primaryBattlefields = layoutHints.battlefields ?? {};
  const scoreByPlayerId = (player: RoomPlayer | null) => player?.board?.score ?? 0;
  const clockFor = (player: RoomPlayer | null) =>
    player ? (layoutHints.clocksByPlayerId?.[player.id] ?? null) : null;
  const onlineFor = (player: RoomPlayer | null) =>
    !!player &&
    (!!player.isBot ||
      (layoutHints.connectedPlayerIds
        ? layoutHints.connectedPlayerIds.includes(player.id)
        : !player.leftAt));

  const handSlot = slots?.hand;
  const rootClass = showScoreTrack ? ROOT_CLASS_SCORE : ROOT_CLASS_COMPACT;
  const sidebarWidth = layoutHints.sidebarWidthRem ?? metrics.chainLaneWidthRem;
  const viewerCanAct = interaction?.canAct ?? false;
  const armed = interaction?.armedAction ?? { kind: "none" as const };
  const armedCounter: ArmedCounter = armed.kind === "counter" ? armed.counter : null;

  return (
    <SidebarLayoutContext.Provider value={sidebarLayout}>
      <BoardCustomizationProvider room={state} viewerId={viewer.id}>
        <div
          className={
            "relative flex h-full min-h-0 w-full gap-0" + (className ? ` ${className}` : "")
          }
          data-game-board-shell="true"
          style={{ ["--sidebar-width" as string]: `${sidebarWidth}rem` }}
        >
          <section
            ref={boardRef}
            data-testid="game-ready"
            data-lines-controls={layoutHints.boardLines ?? "default"}
            data-board-lines={layoutHints.boardLines ?? "default"}
            data-tablet-layout={touchLayout ? "true" : "false"}
            data-tablet-compact={tabletCompact ? "true" : "false"}
            data-board-arrangement={composition.arrangement}
            data-board-measured="true"
            data-sidebar-presentation="overlay"
            data-hand-controls-above={composition.handControls === "above"}
            data-board-density={composition.density}
            data-board-short={composition.short}
            data-board-tight-rail={composition.tightRail}
            data-player-identity-placement={composition.identity}
            data-hand-end-reserved={composition.reserveHandEnd}
            data-board-dragging={interaction?.drag.active ? "true" : "false"}
            data-card-size-percent={localSettings.cardSizePercent}
            data-compact-opponent-count={usesCompactOpponentRail ? opponents.length : 0}
            data-game-outcome={state.gameOutcome ? state.gameOutcome.reason : undefined}
            data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
            data-suppress-board-hover-tone="false"
            className={rootClass}
            style={boardStyle}
            onContextMenuCapture={(event) => {
              const target = event.target;
              if (target instanceof Element && target.closest('[data-chat-panel-root="true"]'))
                return;
              if (event.shiftKey) return;
              event.preventDefault();
              interaction?.handleBoardContextMenu(event);
            }}
            onPointerDown={interaction?.handleBoardPointerDown}
            onDragEnd={() => interaction?.handleCardDragEnd()}
          >
            <ArenaBackdrop />
            <div
              ref={fieldRef}
              data-board-play-area="true"
              data-board-field="true"
              className="relative h-full w-full rounded-xs overflow-visible"
              style={{
                ["--self-glass-intensity" as string]: 1,
                ["--opponent-glass-intensity" as string]: 1,
              }}
            >
              <Playmat />

              <BattlefieldLayer
                room={state}
                viewer={viewer}
                opponents={opponents}
                battlefields={primaryBattlefields}
                onCardEvent={effectiveCardHandler}
                compactColumns={layoutHints.compactBattlefieldColumns}
                selectedCardIds={selected}
                targetableCardIds={targetable}
              />

              {!usesCompactOpponentRail && opponent ? (
                <PlayerLayer
                  player={opponent}
                  board={opponent.board ?? { ...EMPTY_BOARD }}
                  side="opponent"
                  opponentHandRevealed={layoutHints.opponentHandRevealed}
                  onCardEvent={effectiveCardHandler}
                  cardWidthRem={metrics.cardWidthRem}
                  selectedCardIds={selected}
                  targetableCardIds={targetable}
                  autoPayPreviewCardIds={autoPayPreview}
                  touchLayout={touchLayout}
                />
              ) : null}

              <PlayerLayer
                player={viewer}
                board={viewer.board ?? { ...EMPTY_BOARD }}
                side="self"
                handRevealed={layoutHints.handRevealed}
                onCardEvent={effectiveCardHandler}
                handSlot={handSlot}
                cardWidthRem={metrics.cardWidthRem}
                selectedCardIds={selected}
                targetableCardIds={targetable}
                autoPayPreviewCardIds={autoPayPreview}
                touchLayout={touchLayout}
              />

              {usesCompactOpponentRail
                ? opponents.map((player, index) => (
                    <CompactOpponentRail
                      key={player.id}
                      player={player}
                      score={scoreByPlayerId(player)}
                      clock={clockFor(player) ?? undefined}
                      count={index}
                    />
                  ))
                : null}

              {showScoreTrack ? (
                <>
                  <IdentityRail side="self" rowCount={scoreTrack.nodeCount} />
                  <IdentityRail side="opponent" rowCount={scoreTrack.nodeCount} />
                  <ScoreTrack
                    side="self"
                    values={scoreTrack.playerValues}
                    score={scoreByPlayerId(viewer)}
                    winningValue={victoryScore}
                  />
                  <ScoreTrack
                    side="opponent"
                    values={scoreTrack.opponentValues}
                    score={scoreByPlayerId(opponent)}
                    winningValue={victoryScore}
                  />
                </>
              ) : null}

              <IdentityBadge
                player={viewer}
                side="self"
                clock={clockFor(viewer)}
                active={activeTurnSide === "self"}
                online={onlineFor(viewer)}
              />
              {!usesCompactOpponentRail && opponent ? (
                <IdentityBadge
                  player={opponent}
                  side="opponent"
                  clock={clockFor(opponent)}
                  active={activeTurnSide === "opponent"}
                  online={onlineFor(opponent)}
                />
              ) : null}

              {activeTurnSide === "opponent" ? (
                <OpponentPhaseIndicator phase={phase} />
              ) : showTurnControls ? (
                <div data-player-area="actions" className="contents">
                  <BoardTurnControls
                    state={state}
                    viewerId={viewerId}
                    dispatch={interaction?.slotProps.dispatch ?? (() => undefined)}
                    canSwitchSeat={layoutHints.canSwitchSeat ?? true}
                    canEndTurn={layoutHints.canEndTurn ?? true}
                    onSwitchSeat={interaction?.handleSwitchPerspective}
                    onEndTurn={interaction?.handleEndTurn}
                  />
                </div>
              ) : (
                <PhaseIndicator phase={phase} />
              )}

              {/* Wave-2 prompts / dialogs plug in here. */}
              <div data-board-slot="prompts" className="pointer-events-none absolute inset-0 z-150">
                {slots?.prompts ?? null}
              </div>
              {/* Wave-2 overlays (arrows, emotes, ping flashes, drag ghost) plug in here. */}
              <div
                data-board-slot="overlays"
                className="pointer-events-none absolute inset-0 z-140"
              >
                {slots?.overlays ?? null}
              </div>
            </div>

            {sidebarCollapsed ? (
              <div className="absolute right-[0.3rem] top-[0.3rem] z-90 flex flex-col items-end gap-[0.24rem]">
                <button
                  type="button"
                  data-testid="sidebar-expand-trigger"
                  data-sidebar-layout-trigger="true"
                  aria-label="Open sidebar"
                  title="Open sidebar"
                  aria-expanded={false}
                  onClick={sidebarLayout.expand}
                  className="hud-glass-button inline-flex h-[1.9rem] w-[1.9rem] items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#bac6d5]"
                >
                  <PanelLeftOpenIcon className="h-[0.9rem] w-[0.9rem]" />
                </button>
                {interaction ? (
                  <div className="hud-glass-panel w-[13rem] max-w-[calc(100vw-1rem)] p-[0.22rem]">
                    <RoomActionBar
                      state={state}
                      viewerId={viewerId}
                      controlledPlayerIds={interaction.slotProps.controlledPlayerIds}
                      dispatch={interaction.slotProps.dispatch}
                      onSwitchSeat={interaction.slotProps.onSwitchSeat}
                      onNextGame={interaction.slotProps.onNextGame}
                      onLeaveRoom={interaction.slotProps.onLeaveRoom}
                      onReturnToLobby={interaction.slotProps.onReturnToLobby}
                      canNextGame={canStartNextGame({
                        room: state,
                        expectedPlayers: state.players.length,
                      })}
                      showLeave={state.phase !== "lobby"}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {interaction ? (
              <div
                data-board-action-dock="true"
                className="pointer-events-none absolute bottom-[0.35rem] right-[calc(var(--chain-lane-width)+0.55rem)] z-150 flex items-end justify-end"
              >
                <div className="pointer-events-auto">
                  <ActionDock
                    state={state}
                    viewerId={viewerId}
                    dispatch={interaction.slotProps.dispatch}
                    busy={!viewerCanAct}
                    armedCounter={armedCounter}
                    buffArmed={armed.kind === "buff"}
                    duplicateArmed={armed.kind === "duplicate"}
                    labelArmed={armed.kind === "label"}
                    hideLabel={!!interaction.strictView && !interaction.strictManual}
                    giveControlArmed={armed.kind === "transfer_control"}
                    onArmCounter={(next) =>
                      interaction.setArmedAction(
                        next ? { kind: "counter", counter: next } : { kind: "none" },
                      )
                    }
                    onArmBuff={(next) =>
                      interaction.setArmedAction(next ? { kind: "buff" } : { kind: "none" })
                    }
                    onArmDuplicate={(next) =>
                      interaction.setArmedAction(next ? { kind: "duplicate" } : { kind: "none" })
                    }
                    onArmLabel={(next) =>
                      interaction.setArmedAction(next ? { kind: "label" } : { kind: "none" })
                    }
                    onArmGiveControl={(next) =>
                      interaction.setArmedAction(
                        next ? { kind: "transfer_control" } : { kind: "none" },
                      )
                    }
                    onBoardEmote={interaction.slotProps.onBoardEmote}
                  />
                </div>
              </div>
            ) : null}

            {/* Right column: the original `gb-board` grid reserves one lane for the
            sidebar, and the chain panel lives inside that sidebar. When no sidebar is
            supplied (rare harnesses) the lane falls back to the chain panel. */}
            {hasSidebar && !sidebarCollapsed ? (
              <aside
                data-slot="sidebar"
                data-board-slot="sidebar"
                data-chain-lane="true"
                className="relative flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden"
                style={{ width: "var(--chain-lane-width)" }}
              >
                {slots.sidebar}
              </aside>
            ) : (
              <div
                data-chain-lane="true"
                data-drop-zone-root="chain"
                data-zone-owner="self"
                className="relative z-1 min-h-0 min-w-0"
                {...interaction?.getDropZoneHandlers("chain", "self")}
              >
                {slots?.chain ?? null}
              </div>
            )}
          </section>
        </div>
      </BoardCustomizationProvider>
    </SidebarLayoutContext.Provider>
  );
}

const EMPTY_BOARD = {
  score: 0,
  floatingEnergy: 0,
  floatingPower: 0,
  deck: [],
  hand: [],
  handRevealToOpponent: false,
  base: [],
  trash: [],
  banished: [],
  battlefieldA: [],
  battlefieldB: [],
  battlefieldC: [],
  battlefieldToken: [],
  champion: [],
  legend: [],
  runeDeck: [],
  runeArea: [],
  deckPeek: { cardIds: [], revealedCardIds: [] },
};
